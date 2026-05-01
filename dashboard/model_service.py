"""
Veracity AI — Model Service

Handles model lifecycle (loading, inference) and explanation generation
(LIME for text, Grad-CAM for images). This is the core ML layer.
"""

from __future__ import annotations

import base64
import io
import logging
from typing import Any

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from torchvision import transforms
from transformers import AutoTokenizer

from config import (
    BERT_MODEL_NAME,
    IMAGE_SIZE,
    IMAGENET_MEAN,
    IMAGENET_STD,
    INPUT_TYPE_CONFIG,
    KG_DIM,
    LABEL_MAP,
    LIME_NUM_FEATURES,
    LIME_NUM_SAMPLES,
    MAX_SEQ_LENGTH,
    MODEL_PATH,
)
from model import UnifiedMultimodalFakeNewsDetector

logger = logging.getLogger(__name__)

# ── Module-level state ────────────────────────────────────────────────────────
_model: UnifiedMultimodalFakeNewsDetector | None = None
_device: torch.device | None = None
_tokenizer: AutoTokenizer | None = None

_image_transform = transforms.Compose([
    transforms.Resize(256, interpolation=transforms.InterpolationMode.BICUBIC),
    transforms.CenterCrop(IMAGE_SIZE),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
])


# ═══════════════════════════════════════════════════════════════════════════════
#  Initialization
# ═══════════════════════════════════════════════════════════════════════════════

def load_model() -> None:
    """Load model checkpoint and tokenizer into module-level state."""
    global _model, _device, _tokenizer

    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("Loading model on device: %s", _device)

    _model = UnifiedMultimodalFakeNewsDetector()
    checkpoint = torch.load(MODEL_PATH, map_location=_device, weights_only=False)

    # Handle both raw state_dict and wrapped checkpoint formats
    state_dict = checkpoint.get("model_state_dict", checkpoint)
    _model.load_state_dict(state_dict, strict=False)
    _model.to(_device)
    _model.eval()
    logger.info("Model loaded successfully from %s", MODEL_PATH)

    _tokenizer = AutoTokenizer.from_pretrained(BERT_MODEL_NAME)
    logger.info("Tokenizer loaded: %s", BERT_MODEL_NAME)


def is_model_loaded() -> bool:
    """Check whether the model is ready for inference."""
    return _model is not None and _tokenizer is not None


# ═══════════════════════════════════════════════════════════════════════════════
#  Preprocessing
# ═══════════════════════════════════════════════════════════════════════════════

def _preprocess_text(text: str) -> dict[str, torch.Tensor]:
    """Tokenize text using the multilingual BERT tokenizer.

    Returns dict with 'input_ids' and 'attention_mask', each shaped (1, seq_len).
    """
    encoding = _tokenizer(
        text,
        max_length=MAX_SEQ_LENGTH,
        padding="max_length",
        truncation=True,
        return_tensors="pt",
    )
    return {
        "input_ids": encoding["input_ids"].to(_device),
        "attention_mask": encoding["attention_mask"].to(_device),
    }


def _preprocess_image(image: Image.Image) -> torch.Tensor:
    """Transform a PIL image to a normalized tensor of shape (1, 3, 224, 224)."""
    tensor = _image_transform(image.convert("RGB"))
    return tensor.unsqueeze(0).to(_device)


def _create_dummy_image() -> torch.Tensor:
    """Return a zero tensor for text-only prediction modes."""
    return torch.zeros(1, 3, IMAGE_SIZE, IMAGE_SIZE, device=_device)


def _create_zero_kg() -> torch.Tensor:
    """Return a zero-vector KG embedding (simplified, no external KG query)."""
    return torch.zeros(1, KG_DIM, device=_device)


# ═══════════════════════════════════════════════════════════════════════════════
#  Core Prediction
# ═══════════════════════════════════════════════════════════════════════════════

def predict(
    text: str | None,
    image: Image.Image | None,
    input_type: str,
) -> dict[str, Any]:
    """Run a single prediction through the model.

    Args:
        text:       Input text (None for image-only mode)
        image:      PIL Image (None for text-only mode)
        input_type: One of 'gossipcop_text', 'weibo_text', 'weibo_image', 'weibo_both'

    Returns:
        Dict with prediction, confidence, probabilities, and explanation fields.
    """
    if not is_model_loaded():
        raise RuntimeError("Model not loaded. Call load_model() first.")

    config = INPUT_TYPE_CONFIG[input_type]

    # ── Prepare inputs ────────────────────────────────────────────────────
    if config["requires_text"] and text:
        tokens = _preprocess_text(text)
    else:
        # For image-only: tokenize empty string to satisfy model signature
        tokens = _preprocess_text("")

    if config["requires_image"] and image:
        image_tensor = _preprocess_image(image)
        has_image = torch.tensor([1.0], device=_device)
    else:
        image_tensor = _create_dummy_image()
        has_image = torch.tensor([0.0], device=_device)

    kg_embedding = _create_zero_kg()

    # ── Forward pass ──────────────────────────────────────────────────────
    with torch.no_grad():
        logits = _model(
            input_ids=tokens["input_ids"],
            attention_mask=tokens["attention_mask"],
            image_tensor=image_tensor,
            has_image_flag=has_image,
            kg_embedding=kg_embedding,
        )

    probabilities = F.softmax(logits, dim=1).squeeze(0)
    prob_real = probabilities[0].item()
    prob_fake = probabilities[1].item()
    predicted_class = int(probabilities.argmax().item())
    confidence = max(prob_real, prob_fake) * 100

    # ── Build result ──────────────────────────────────────────────────────
    result: dict[str, Any] = {
        "prediction": LABEL_MAP[predicted_class],
        "confidence": round(confidence, 2),
        "probability_real": round(prob_real, 4),
        "probability_fake": round(prob_fake, 4),
        "input_type": input_type,
        "lang": config["lang"],
    }

    # ── Explanations ──────────────────────────────────────────────────────
    explanation: dict[str, Any] = {"text": None, "image": None}

    if config["requires_text"] and text:
        try:
            explanation["text"] = _explain_text_lime(text, config["lang"])
        except Exception as exc:
            logger.warning("LIME explanation failed: %s", exc)
            explanation["text"] = {"tokens": [], "html": "<p>Explanation unavailable</p>"}

    if config["requires_image"] and image:
        try:
            explanation["image"] = _explain_image_gradcam(
                image, image_tensor, predicted_class,
            )
        except Exception as exc:
            logger.warning("Grad-CAM explanation failed: %s", exc)
            explanation["image"] = {"heatmap_base64": ""}

    result["explanation"] = explanation
    return result


def predict_text_only(text: str, lang: str) -> dict[str, Any]:
    """Convenience wrapper for batch text-only prediction.

    Determines input_type from the language code.
    """
    input_type = "gossipcop_text" if lang == "en" else "weibo_text"
    return predict(text=text, image=None, input_type=input_type)


# ═══════════════════════════════════════════════════════════════════════════════
#  Text Explanation — LIME
# ═══════════════════════════════════════════════════════════════════════════════

def _lime_predict_fn(texts: list[str], lang: str = "en") -> np.ndarray:
    """Prediction function for LIME. Takes a list of strings, returns (N, 2) probs."""
    results = []
    for t in texts:
        tokens = _preprocess_text(t)
        image_tensor = _create_dummy_image()
        has_image = torch.tensor([0.0], device=_device)
        kg_embedding = _create_zero_kg()

        with torch.no_grad():
            logits = _model(
                input_ids=tokens["input_ids"],
                attention_mask=tokens["attention_mask"],
                image_tensor=image_tensor,
                has_image_flag=has_image,
                kg_embedding=kg_embedding,
            )
        probs = F.softmax(logits, dim=1).squeeze(0).cpu().numpy()
        results.append(probs)

    return np.array(results)


def _explain_text_lime(text: str, lang: str) -> dict[str, Any]:
    """Generate LIME explanation for text input.

    Returns:
        Dict with 'tokens' (list of {token, weight}) and 'html' (rendered HTML).
    """
    import lime.lime_text

    explainer = lime.lime_text.LimeTextExplainer(class_names=["Real", "Fake"])

    def predict_fn(texts):
        return _lime_predict_fn(texts, lang=lang)

    explanation = explainer.explain_instance(
        text,
        predict_fn,
        num_features=LIME_NUM_FEATURES,
        num_samples=LIME_NUM_SAMPLES,
    )

    tokens = [
        {"token": token, "weight": round(weight, 4)}
        for token, weight in explanation.as_list()
    ]

    html = explanation.as_html()

    return {"tokens": tokens, "html": html}


# ═══════════════════════════════════════════════════════════════════════════════
#  Image Explanation — Grad-CAM
# ═══════════════════════════════════════════════════════════════════════════════

def _explain_image_gradcam(
    original_image: Image.Image,
    preprocessed_tensor: torch.Tensor,
    target_class: int,
) -> dict[str, str]:
    """Generate Grad-CAM heatmap for the image branch.

    Hooks into ResNet-50 layer4 to capture feature maps and gradients,
    then computes a class activation map overlaid on the original image.

    Returns:
        Dict with 'heatmap_base64' containing the overlaid PNG as a data URI.
    """
    # Storage for hooks
    feature_maps: list[torch.Tensor] = []
    gradients: list[torch.Tensor] = []

    target_layer = _model.resnet.layer4

    def forward_hook(module, input, output):
        feature_maps.append(output.detach())

    def backward_hook(module, grad_input, grad_output):
        gradients.append(grad_output[0].detach())

    fwd_handle = target_layer.register_forward_hook(forward_hook)
    bwd_handle = target_layer.register_full_backward_hook(backward_hook)

    try:
        # Forward pass with gradients enabled
        tokens = _preprocess_text("")
        kg_embedding = _create_zero_kg()
        has_image = torch.tensor([1.0], device=_device)

        image_input = preprocessed_tensor.clone().requires_grad_(True)

        _model.zero_grad()
        logits = _model(
            input_ids=tokens["input_ids"],
            attention_mask=tokens["attention_mask"],
            image_tensor=image_input,
            has_image_flag=has_image,
            kg_embedding=kg_embedding,
        )

        # Backward pass from target class
        target_score = logits[0, target_class]
        target_score.backward()

        # Compute Grad-CAM heatmap
        grads = gradients[0]            # (1, C, H, W)
        feats = feature_maps[0]         # (1, C, H, W)
        weights = grads.mean(dim=[2, 3], keepdim=True)  # (1, C, 1, 1)
        cam = F.relu((weights * feats).sum(dim=1, keepdim=True))  # (1, 1, H, W)

        # Normalize to [0, 1]
        cam = cam.squeeze().cpu().numpy()
        if cam.max() > 0:
            cam = cam / cam.max()

        # Resize heatmap to original image size
        orig_np = np.array(original_image.convert("RGB").resize((IMAGE_SIZE, IMAGE_SIZE)))
        heatmap = cv2.resize(cam, (IMAGE_SIZE, IMAGE_SIZE))
        heatmap = np.uint8(255 * heatmap)
        heatmap_colored = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
        heatmap_colored = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)

        # Overlay
        overlay = (0.6 * orig_np + 0.4 * heatmap_colored).astype(np.uint8)

        # Encode to base64
        pil_overlay = Image.fromarray(overlay)
        buffer = io.BytesIO()
        pil_overlay.save(buffer, format="PNG")
        img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return {"heatmap_base64": f"data:image/png;base64,{img_base64}"}

    finally:
        fwd_handle.remove()
        bwd_handle.remove()
