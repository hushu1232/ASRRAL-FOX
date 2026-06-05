"""Gradio Web UI for AstralFox Rigging Pipeline.

A user-friendly web interface for the AI-powered rigging pipeline.
Allows non-technical users to:
- Upload character illustrations
- Preview AI layer separation results
- Configure rigging parameters
- Export Cubism model packages
- Deploy to AstralFox desktop pet

Run: python -m ui.app

Requires: pip install gradio
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))


def create_app():
    """Create the Gradio interface."""
    try:
        import gradio as gr
    except ImportError:
        raise ImportError("Gradio not installed: pip install gradio")

    import os
    import requests

    API_BASE = os.environ.get("API_BASE", "http://localhost:8001")

    # ── API client functions ────────────────────────────────────────

    def upload_image(file):
        if file is None:
            return "", "Please select a file first."
        resp = requests.post(
            f"{API_BASE}/api/upload",
            files={"file": (file.name, open(file.name, "rb"))},
        )
        data = resp.json()
        return data["image_id"], f"Uploaded: {data['filename']} ({data['size']} bytes)"

    def run_separation(image_id):
        if not image_id:
            return "Please upload an image first.", []
        resp = requests.post(
            f"{API_BASE}/api/separate/",
            json={"image_id": image_id, "edge_refine": True},
        )
        data = resp.json()
        layers = data["layers"]
        info = f"Found {len(layers)} layers in {data['processing_time_ms']:.0f}ms\n"
        for l in layers:
            info += f"  - {l['label']}: bbox={l['bbox']}\n"
        urls = [API_BASE + l["texture_url"] for l in layers]
        return info, urls

    def run_rigging(image_id, template, mesh_density):
        if not image_id:
            return "Please upload an image first."
        # First separate
        sep_resp = requests.post(
            f"{API_BASE}/api/separate/",
            json={"image_id": image_id, "edge_refine": True},
        )
        sep_data = sep_resp.json()

        # Then rig
        rig_resp = requests.post(
            f"{API_BASE}/api/rig/",
            json={
                "image_id": image_id,
                "layers": sep_data["layers"],
                "template": template,
                "mesh_density": mesh_density,
            },
        )
        rig_data = rig_resp.json()

        skeleton = rig_data["skeleton"]
        bones_flat = _flatten_bones(skeleton)

        info = (
            f"Rigging complete in {rig_data['processing_time_ms']:.0f}ms\n"
            f"Template: {template}\n"
            f"Meshes: {rig_data['mesh_count']}\n"
            f"Bones: {len(bones_flat)}\n\n"
            f"Skeleton:\n"
        )
        for name, pos in bones_flat:
            info += f"  {name}: ({pos[0]:.0f}, {pos[1]:.0f})\n"
        return info

    def run_export(image_id, template, mesh_density):
        if not image_id:
            return "Please upload an image first.", None

        # Separate
        sep_resp = requests.post(
            f"{API_BASE}/api/separate/",
            json={"image_id": image_id, "edge_refine": True},
        )
        sep_data = sep_resp.json()

        # Rig
        rig_resp = requests.post(
            f"{API_BASE}/api/rig/",
            json={
                "image_id": image_id,
                "layers": sep_data["layers"],
                "template": template,
                "mesh_density": mesh_density,
            },
        )
        rig_data = rig_resp.json()

        # Export
        export_resp = requests.post(
            f"{API_BASE}/api/export/",
            json={
                "image_id": image_id,
                "skeleton": rig_data["skeleton"],
                "layers": sep_data["layers"],
            },
        )
        export_data = export_resp.json()

        info = (
            f"Export complete in {export_data['processing_time_ms']:.0f}ms\n\n"
            f"Files:\n"
            f"  .cmo3: {export_data['cmo3_url']}\n"
            f"  .moc3: {export_data.get('moc3_url', 'N/A')}\n"
            f"  .model3.json: {export_data['model3_json_url']}\n"
            f"  Textures: {len(export_data['textures_urls'])}\n\n"
            f"Download: {API_BASE}/api/export/download/{image_id}"
        )
        download_url = f"{API_BASE}/api/export/download/{image_id}"
        return info, download_url

    def run_full_pipeline(image_id, template, mesh_density, auto_deploy):
        if not image_id:
            return "Please upload an image first."
        resp = requests.post(
            f"{API_BASE}/api/pipeline/",
            json={
                "image_id": image_id,
                "template": template,
                "mesh_density": mesh_density,
                "auto_deploy": auto_deploy,
            },
        )
        data = resp.json()
        info = (
            f"Pipeline complete in {data['total_time_ms']:.0f}ms\n"
            f"{'='*40}\n"
            f"Separation: {data['separate']['processing_time_ms']:.0f}ms, "
            f"{len(data['separate']['layers'])} layers\n"
            f"Rigging: {data['rig']['processing_time_ms']:.0f}ms, "
            f"{data['rig']['mesh_count']} meshes\n"
            f"Export: {data['export']['processing_time_ms']:.0f}ms\n"
            f"MOC3: {data['export'].get('moc3_url', 'N/A')}\n"
        )
        if data.get("deploy"):
            d = data["deploy"]
            info += (
                f"\nDeploy: {d['processing_time_ms']:.0f}ms\n"
                f"Path: {d['deployed_path']}\n"
                f"Hot reload: {'Yes' if d['reload_triggered'] else 'No'}\n"
                f"Configs: {', '.join(d.get('configs_written', []))}\n"
            )
        return info

    def _flatten_bones(bone, prefix=""):
        """Flatten bone tree for display."""
        full = f"{prefix}/{bone['name']}" if prefix else bone["name"]
        result = [(full, bone["position"])]
        for child in bone.get("children", []):
            result.extend(_flatten_bones(child, full))
        return result

    # ── Build UI ────────────────────────────────────────────────────

    with gr.Blocks(
        title="AstralFox Rigging Pipeline",
        theme=gr.themes.Soft(),
    ) as app:
        gr.Markdown("# AstralFox Rigging Pipeline")
        gr.Markdown("AI-powered Live2D rigging for AstralFox desktop pet")

        image_id_state = gr.State("")

        with gr.Tabs():
            # Tab 1: Upload
            with gr.Tab("1. Upload"):
                with gr.Row():
                    with gr.Column(scale=1):
                        file_input = gr.File(
                            label="Character Image",
                            file_types=["image"],
                        )
                        upload_btn = gr.Button("Upload", variant="primary")
                    with gr.Column(scale=1):
                        upload_status = gr.Textbox(label="Status", interactive=False)

                upload_btn.click(
                    upload_image,
                    inputs=[file_input],
                    outputs=[image_id_state, upload_status],
                )

            # Tab 2: Separate
            with gr.Tab("2. Separate Layers"):
                sep_btn = gr.Button("Run Separation", variant="primary")
                sep_status = gr.Textbox(label="Status", interactive=False)
                sep_gallery = gr.Gallery(
                    label="Separated Layers",
                    columns=5,
                    height=300,
                )

                sep_btn.click(
                    run_separation,
                    inputs=[image_id_state],
                    outputs=[sep_status, sep_gallery],
                )

            # Tab 3: Rigging
            with gr.Tab("3. Rigging"):
                with gr.Row():
                    rig_template = gr.Dropdown(
                        choices=["catgirl", "human_female", "human_male"],
                        value="catgirl",
                        label="Skeleton Template",
                    )
                    rig_density = gr.Dropdown(
                        choices=["low", "medium", "high"],
                        value="medium",
                        label="Mesh Density",
                    )
                rig_btn = gr.Button("Run Rigging", variant="primary")
                rig_status = gr.Textbox(label="Skeleton Info", lines=15, interactive=False)

                rig_btn.click(
                    run_rigging,
                    inputs=[image_id_state, rig_template, rig_density],
                    outputs=[rig_status],
                )

            # Tab 4: Export
            with gr.Tab("4. Export"):
                with gr.Row():
                    exp_template = gr.Dropdown(
                        choices=["catgirl", "human_female", "human_male"],
                        value="catgirl",
                        label="Template",
                    )
                    exp_density = gr.Dropdown(
                        choices=["low", "medium", "high"],
                        value="medium",
                        label="Mesh Density",
                    )
                exp_btn = gr.Button("Export Model", variant="primary")
                exp_status = gr.Textbox(label="Export Result", lines=10, interactive=False)
                exp_download = gr.Textbox(label="Download URL", interactive=False)

                exp_btn.click(
                    run_export,
                    inputs=[image_id_state, exp_template, exp_density],
                    outputs=[exp_status, exp_download],
                )

            # Tab 5: Full Pipeline
            with gr.Tab("5. Full Pipeline"):
                with gr.Row():
                    pipe_template = gr.Dropdown(
                        choices=["catgirl", "human_female", "human_male"],
                        value="catgirl",
                        label="Template",
                    )
                    pipe_density = gr.Dropdown(
                        choices=["low", "medium", "high"],
                        value="medium",
                        label="Mesh Density",
                    )
                pipe_deploy = gr.Checkbox(label="Auto-deploy to AstralFox", value=False)
                pipe_btn = gr.Button("Run Full Pipeline", variant="primary")
                pipe_status = gr.Textbox(label="Pipeline Result", lines=15, interactive=False)

                pipe_btn.click(
                    run_full_pipeline,
                    inputs=[image_id_state, pipe_template, pipe_density, pipe_deploy],
                    outputs=[pipe_status],
                )

    return app


if __name__ == "__main__":
    app = create_app()
    app.launch(server_port=7860)
