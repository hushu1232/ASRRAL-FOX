"""
Azure Speech-to-Text (ASR) Service
==================================
Streams PCM audio to Azure Speech Services and yields
partial/final transcripts in real time.

Fallback: If Azure credentials are not configured, returns
a mock echo transcript.
"""
import asyncio
import logging
from typing import AsyncIterator, Optional

from config import AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, ASR_LANGUAGE

logger = logging.getLogger("asr")

try:
    import azure.cognitiveservices.speech as speechsdk
    HAS_AZURE_SDK = bool(AZURE_SPEECH_KEY)
except ImportError:
    HAS_AZURE_SDK = False


class ASRResult:
    """A single ASR result event."""
    __slots__ = ("text", "is_final")

    def __init__(self, text: str, is_final: bool = False):
        self.text = text
        self.is_final = is_final


class ASRService:
    """
    Azure Speech recognizer with push-stream audio input.

    Usage:
        asr = ASRService()
        asr.start()

        # Feed audio chunks as they arrive
        asr.write(pcm_bytes)

        # When user stops speaking:
        result = await asr.finalize()

        # Or iterate results as they come:
        async for result in asr.results():
            ...
    """

    def __init__(self):
        self._push_stream: Optional[speechsdk.audio.PushAudioInputStream] = None
        self._recognizer: Optional[speechsdk.SpeechRecognizer] = None
        self._result_queue: asyncio.Queue = asyncio.Queue()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._done = False
        self._final_text = ""

    # ── Public API ─────────────────────────────────────────

    def start(self):
        """Begin recognition session."""
        self._loop = asyncio.get_event_loop()

        if not HAS_AZURE_SDK:
            logger.info("ASR: Azure SDK not available — using mock mode")
            return

        speech_config = speechsdk.SpeechConfig(
            subscription=AZURE_SPEECH_KEY,
            region=AZURE_SPEECH_REGION
        )
        speech_config.speech_recognition_language = ASR_LANGUAGE

        # Use push stream so we can feed audio in real time
        audio_format = speechsdk.audio.AudioStreamFormat(
            samples_per_second=16000, bits_per_sample=16, channels=1
        )
        self._push_stream = speechsdk.audio.PushAudioInputStream(stream_format=audio_format)
        audio_config = speechsdk.audio.AudioConfig(stream=self._push_stream)

        self._recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config, audio_config=audio_config
        )

        # Wire events
        self._recognizer.recognizing.connect(self._on_recognizing)
        self._recognizer.recognized.connect(self._on_recognized)
        self._recognizer.session_stopped.connect(self._on_session_stopped)
        self._recognizer.canceled.connect(self._on_canceled)

        self._recognizer.start_continuous_recognition_async()
        logger.info("ASR: recognition started")

    def write(self, pcm_bytes: bytes):
        """Feed raw PCM16 audio to the recognizer."""
        if self._push_stream is not None:
            self._push_stream.write(pcm_bytes)

    async def finalize(self) -> str:
        """
        Signal end of speech and wait for final result.
        Returns the final transcript text.
        """
        if self._push_stream is not None:
            self._push_stream.close()

        if self._recognizer is not None:
            self._recognizer.stop_continuous_recognition_async()

        # Drain remaining results
        try:
            while not self._done:
                result = await asyncio.wait_for(self._result_queue.get(), timeout=5.0)
                if result.is_final and result.text:
                    self._final_text = result.text
        except asyncio.TimeoutError:
            pass

        self._done = True
        return self._final_text

    async def results(self) -> AsyncIterator[ASRResult]:
        """Async iterator yielding results as they arrive."""
        while not self._done:
            try:
                result = await asyncio.wait_for(self._result_queue.get(), timeout=30.0)
                yield result
                if result.is_final:
                    break
            except asyncio.TimeoutError:
                break

    def close(self):
        """Clean up resources."""
        if self._push_stream is not None:
            try:
                self._push_stream.close()
            except Exception:
                pass
        if self._recognizer is not None:
            try:
                self._recognizer.stop_continuous_recognition_async()
            except Exception:
                pass
        self._done = True

    # ── Azure Callbacks (run on internal threads) ──────────

    def _on_recognizing(self, evt):
        if evt.result.text and self._loop is not None:
            self._loop.call_soon_threadsafe(
                self._result_queue.put_nowait,
                ASRResult(evt.result.text, is_final=False)
            )
            logger.debug(f"ASR partial: {evt.result.text}")

    def _on_recognized(self, evt):
        if evt.result.text and self._loop is not None:
            self._loop.call_soon_threadsafe(
                self._result_queue.put_nowait,
                ASRResult(evt.result.text, is_final=True)
            )
            logger.info(f"ASR final: {evt.result.text}")

    def _on_session_stopped(self, evt):
        logger.info("ASR: session stopped")
        self._done = True

    def _on_canceled(self, evt):
        reason = evt.result.cancellation_details.reason
        logger.warning(f"ASR canceled: {reason}")
        if reason == speechsdk.CancellationReason.Error:
            logger.error(f"ASR error: {evt.result.cancellation_details.error_details}")
        self._done = True
        if self._loop is not None:
            self._loop.call_soon_threadsafe(
                self._result_queue.put_nowait,
                ASRResult("", is_final=True)
            )


# ── Mock ASR (fallback when no Azure key) ──────────────────


class ASRUnavailableError(Exception):
    """ASR service not configured — caller should inform user."""
    pass


async def mock_recognize(pcm_bytes_list: list) -> str:
    """
    ASR unavailable: raise an explicit error instead of returning fake
    transcripts that would cause confusing LLM responses.
    """
    raise ASRUnavailableError(
        "语音识别服务未配置。请在设置中填入 Azure Speech Key，"
        "或切换到本地 FunASR 模式。"
    )
