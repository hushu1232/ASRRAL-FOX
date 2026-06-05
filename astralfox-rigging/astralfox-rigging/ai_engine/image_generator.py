"""ComfyUI image generator for anatomical standing pose conversion.

Converts character images to strictly symmetrical anatomical standard
standing pose using ComfyUI img2img workflow.

Features:
- Upload images to ComfyUI server
- Execute img2img workflow with customizable prompts
- Poll for completion and download results
- Configurable via config.yaml
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from pathlib import Path
from typing import Any, Optional

import requests
import yaml

logger = logging.getLogger(__name__)


class ComfyUIError(Exception):
    """Base exception for ComfyUI errors."""
    pass


class ComfyUITimeoutError(ComfyUIError):
    """Workflow execution timeout."""
    pass


class ComfyUIUploadError(ComfyUIError):
    """Image upload failed."""
    pass


class ComfyUIExecutionError(ComfyUIError):
    """Workflow execution failed."""
    pass


# Default positive prompt for anatomical standing pose
DEFAULT_POSITIVE_PROMPT = (
    "(masterpiece, best quality:1.2), 1girl, standing, full body, "
    "anatomical standing pose, strictly symmetrical, arms straight down, "
    "legs together, palms facing forward, looking straight ahead, front view, "
    "clean outline, perfect anatomy, symmetric joints, visible joint markers, "
    "detailed body proportions, white background"
)

# Default negative prompt
DEFAULT_NEGATIVE_PROMPT = (
    "lowres, bad anatomy, bad hands, text, error, extra digit, fewer digits, "
    "cropped, worst quality, low quality, normal quality, jpeg artifacts, "
    "signature, watermark, username, blurry, asymmetry, twisted body, pose variation"
)


class ComfyUIImageGenerator:
    """ComfyUI API client for image generation.

    Usage:
        generator = ComfyUIImageGenerator()
        result_path = generator.generate_anatomical_standpose(
            image_path="input.png",
            prompt="",
            workflow_template_path="templates/comfyui_workflow_img2img.json",
            output_dir="output/uploads/",
        )
    """

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:8188",
        timeout: int = 120,
    ):
        """Initialize ComfyUI client.

        Args:
            base_url: ComfyUI server URL.
            timeout: Maximum wait time for workflow execution (seconds).
        """
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.client_id = str(uuid.uuid4())

    @classmethod
    def from_config(cls, config_path: str | Path = "config.yaml") -> ComfyUIImageGenerator:
        """Create instance from config.yaml.

        Args:
            config_path: Path to config.yaml file.

        Returns:
            Configured ComfyUIImageGenerator instance.
        """
        config_path = Path(config_path)
        if config_path.exists():
            with open(config_path) as f:
                config = yaml.safe_load(f)
            comfyui_config = config.get("comfyui", {})
            return cls(
                base_url=comfyui_config.get("base_url", "http://127.0.0.1:8188"),
                timeout=comfyui_config.get("timeout", 120),
            )
        return cls()

    def upload_image(self, image_path: str | Path) -> str:
        """Upload an image to ComfyUI server.

        Args:
            image_path: Local path to the image file.

        Returns:
            Filename on ComfyUI server.

        Raises:
            ComfyUIUploadError: If upload fails.
        """
        image_path = Path(image_path)
        if not image_path.exists():
            raise ComfyUIUploadError(f"Image not found: {image_path}")

        url = f"{self.base_url}/upload/image"

        try:
            with open(image_path, "rb") as f:
                files = {"image": (image_path.name, f, "image/png")}
                data = {"overwrite": "true"}
                response = requests.post(url, files=files, data=data, timeout=30)

            if response.status_code != 200:
                raise ComfyUIUploadError(
                    f"Upload failed with status {response.status_code}: {response.text}"
                )

            result = response.json()
            filename = result.get("name", image_path.name)
            logger.info(f"Uploaded image to ComfyUI: {filename}")
            return filename

        except requests.exceptions.RequestException as e:
            raise ComfyUIUploadError(f"Upload request failed: {e}")

    def queue_prompt(self, workflow: dict[str, Any]) -> str:
        """Submit a workflow to ComfyUI for execution.

        Args:
            workflow: Workflow JSON dict.

        Returns:
            prompt_id for tracking execution.

        Raises:
            ComfyUIExecutionError: If submission fails.
        """
        url = f"{self.base_url}/prompt"
        payload = {
            "prompt": workflow,
            "client_id": self.client_id,
        }

        try:
            response = requests.post(url, json=payload, timeout=30)
            if response.status_code != 200:
                raise ComfyUIExecutionError(
                    f"Failed to queue prompt: {response.status_code} {response.text}"
                )

            result = response.json()
            prompt_id = result.get("prompt_id")
            if not prompt_id:
                raise ComfyUIExecutionError(f"No prompt_id in response: {result}")

            logger.info(f"Queued workflow: {prompt_id}")
            return prompt_id

        except requests.exceptions.RequestException as e:
            raise ComfyUIExecutionError(f"Queue request failed: {e}")

    def wait_for_completion(self, prompt_id: str) -> dict[str, Any]:
        """Poll /history until workflow completes.

        Args:
            prompt_id: The prompt ID to track.

        Returns:
            History data for the completed workflow.

        Raises:
            ComfyUITimeoutError: If workflow doesn't complete within timeout.
            ComfyUIExecutionError: If workflow fails.
        """
        url = f"{self.base_url}/history/{prompt_id}"
        start_time = time.time()

        while True:
            elapsed = time.time() - start_time
            if elapsed > self.timeout:
                raise ComfyUITimeoutError(
                    f"Workflow timed out after {self.timeout}s"
                )

            try:
                response = requests.get(url, timeout=10)
                if response.status_code == 200:
                    history = response.json()
                    if prompt_id in history:
                        entry = history[prompt_id]
                        status = entry.get("status", {})

                        if status.get("completed", False):
                            logger.info(f"Workflow completed: {prompt_id}")
                            return entry

                        if status.get("status_str") == "error":
                            messages = status.get("messages", [])
                            raise ComfyUIExecutionError(
                                f"Workflow failed: {messages}"
                            )
            except requests.exceptions.RequestException:
                pass

            time.sleep(1.0)

    def download_output(
        self,
        history: dict[str, Any],
        output_dir: str | Path,
        filename_prefix: str = "generated",
    ) -> Path:
        """Download the output image from completed workflow.

        Args:
            history: History data from wait_for_completion.
            output_dir: Directory to save the image.
            filename_prefix: Prefix for the output filename.

        Returns:
            Path to the downloaded image.

        Raises:
            ComfyUIExecutionError: If no output found or download fails.
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Find output images in history
        outputs = history.get("outputs", {})
        output_image = None

        for node_id, node_output in outputs.items():
            if "images" in node_output:
                for img in node_output["images"]:
                    if img.get("type") == "output":
                        output_image = img
                        break
                if output_image:
                    break

        if not output_image:
            raise ComfyUIExecutionError("No output image found in workflow history")

        # Download image
        filename = output_image["filename"]
        subfolder = output_image.get("subfolder", "")
        url = f"{self.base_url}/view?filename={filename}&subfolder={subfolder}&type=output"

        try:
            response = requests.get(url, timeout=30)
            if response.status_code != 200:
                raise ComfyUIExecutionError(
                    f"Download failed: {response.status_code}"
                )

            # Save with unique filename
            unique_name = f"{filename_prefix}_{uuid.uuid4().hex[:12]}.png"
            output_path = output_dir / unique_name
            output_path.write_bytes(response.content)

            logger.info(f"Downloaded output: {output_path}")
            return output_path

        except requests.exceptions.RequestException as e:
            raise ComfyUIExecutionError(f"Download request failed: {e}")

    def generate_anatomical_standpose(
        self,
        image_path: str | Path,
        prompt: str = "",
        negative_prompt: str = "",
        workflow_template_path: str | Path = "templates/comfyui_workflow_img2img.json",
        output_dir: str | Path = "output/uploads/",
        seed: int = -1,
    ) -> Path:
        """Generate anatomical standing pose from character image.

        Converts a character image to a strictly symmetrical anatomical
        standard standing pose using ComfyUI img2img workflow.

        Args:
            image_path: Path to the input character image.
            prompt: Additional positive prompt (appended to default).
            negative_prompt: Additional negative prompt (overrides default).
            workflow_template_path: Path to workflow JSON template.
            output_dir: Directory to save output image.
            seed: Random seed (-1 for random).

        Returns:
            Path to the generated image.

        Raises:
            ComfyUIError: If any step fails.
        """
        image_path = Path(image_path)
        workflow_template_path = Path(workflow_template_path)

        # Step 1: Load workflow template
        if not workflow_template_path.exists():
            raise ComfyUIError(f"Workflow template not found: {workflow_template_path}")

        with open(workflow_template_path, encoding="utf-8") as f:
            workflow = json.load(f)

        # Step 2: Upload input image
        uploaded_filename = self.upload_image(image_path)

        # Step 3: Build final prompt
        final_positive = DEFAULT_POSITIVE_PROMPT
        if prompt and prompt.strip():
            final_positive = f"{final_positive}, {prompt.strip()}"

        final_negative = negative_prompt.strip() if negative_prompt.strip() else DEFAULT_NEGATIVE_PROMPT

        # Step 4: Replace placeholders in workflow
        workflow_str = json.dumps(workflow)
        workflow_str = workflow_str.replace("input_image_placeholder", uploaded_filename)
        workflow_str = workflow_str.replace("prompt_placeholder", final_positive)
        workflow = json.loads(workflow_str)

        # Update negative prompt
        if "7" in workflow and "inputs" in workflow["7"]:
            workflow["7"]["inputs"]["text"] = final_negative

        # Update seed
        if seed >= 0 and "3" in workflow and "inputs" in workflow["3"]:
            workflow["3"]["inputs"]["seed"] = seed

        # Step 5: Queue and wait
        prompt_id = self.queue_prompt(workflow)
        history = self.wait_for_completion(prompt_id)

        # Step 6: Download result
        result_path = self.download_output(
            history,
            output_dir=output_dir,
            filename_prefix="anatomical",
        )

        return result_path
