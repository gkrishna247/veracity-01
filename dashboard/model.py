"""
Veracity AI — Model Architecture

Defines the UnifiedMultimodalFakeNewsDetector, a multimodal architecture
combining mBERT (text) + ResNet-50 (image) + cross-attention fusion + KG
projection for binary fake news classification.

Architecture:
    Text  → mBERT (CLS pooler) → Linear(768→512)  ─┐
    Image → ResNet-50 (fc=Identity) → Linear(2048→512) ─┤→ Cross-Attention → Gate → Classifier
    KG    → Linear(300→512)  ─────────────────────────┘         ↓
                                                         Linear(512→128→2)

This file is extracted from the original training notebook and must remain
compatible with the saved checkpoint `best_model.pt`.
"""

import torch
import torch.nn as nn
import torchvision.models
from transformers import BertModel


class UnifiedMultimodalFakeNewsDetector(nn.Module):
    """Multimodal fake news detector with text, image, and KG branches.

    Forward signature must match the training checkpoint. Do NOT modify
    parameter names or layer dimensions without retraining.
    """

    def __init__(self) -> None:
        super().__init__()

        # ── Text Branch (mBERT) ───────────────────────────────────────────
        self.bert_zh = BertModel.from_pretrained("bert-base-multilingual-cased")
        self.bert_zh.gradient_checkpointing_enable()

        # ── Image Branch (ResNet-50, frozen except layer4) ────────────────
        self.resnet = torchvision.models.resnet50(
            weights=torchvision.models.ResNet50_Weights.IMAGENET1K_V2,
        )
        self.resnet.fc = nn.Identity()
        for name, param in self.resnet.named_parameters():
            if not name.startswith("layer4"):
                param.requires_grad = False

        # ── Projection Layers ─────────────────────────────────────────────
        self.text_proj = nn.Linear(768, 512)
        self.image_proj = nn.Linear(2048, 512)
        self.kg_proj = nn.Linear(300, 512)

        # ── Cross-Attention Fusion ────────────────────────────────────────
        self.cross_attn = nn.MultiheadAttention(
            embed_dim=512,
            num_heads=8,
            batch_first=True,
            dropout=0.1,
        )
        self.gate_linear = nn.Linear(1024, 512)

        # ── Classifier Head ──────────────────────────────────────────────
        self.classifier = nn.Sequential(
            nn.Linear(512, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.LayerNorm(128),
            nn.Linear(128, 2),
        )

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        image_tensor: torch.Tensor,
        has_image_flag: torch.Tensor,
        kg_embedding: torch.Tensor,
        lang_mask: torch.Tensor | None = None,
    ) -> torch.Tensor:
        """Run multimodal forward pass.

        Args:
            input_ids:      (B, seq_len) tokenized text IDs
            attention_mask:  (B, seq_len) attention mask
            image_tensor:    (B, 3, 224, 224) preprocessed image
            has_image_flag:  (B,) float — 1.0 if image is present, 0.0 otherwise
            kg_embedding:    (B, 300) knowledge graph embedding
            lang_mask:       unused, kept for checkpoint compatibility

        Returns:
            (B, 2) raw logits for [Real, Fake]
        """
        # Text features
        text_features = self.bert_zh(
            input_ids=input_ids,
            attention_mask=attention_mask,
        ).pooler_output

        # Image features (zeroed out when no image present)
        image_features = self.resnet(image_tensor) * has_image_flag.unsqueeze(1)

        # Project to common dimension
        text_proj = self.text_proj(text_features)
        image_proj = self.image_proj(image_features)
        kg_proj = self.kg_proj(kg_embedding)

        # Cross-attention: text attends to image
        attended, _ = self.cross_attn(
            text_proj.unsqueeze(1),
            image_proj.unsqueeze(1),
            image_proj.unsqueeze(1),
        )
        attended = attended.squeeze(1)

        # Gated fusion
        gate = torch.sigmoid(
            self.gate_linear(torch.cat([text_proj, attended], dim=1))
        )
        fused = gate * text_proj + (1.0 - gate) * image_proj + kg_proj

        return self.classifier(fused)
