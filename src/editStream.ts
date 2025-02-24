import { StreamSettings } from "./shared/renderers/ThreeDimensionRendererImpl";

window.addEventListener("message", (event) => {
  const STREAM_ENABLE_INPUT = document.getElementById("stream_enable") as HTMLInputElement;
  const STREAM_ID_INPUT = document.getElementById("stream_id") as HTMLInputElement;
  const STREAM_QUALITY_INPUT = document.getElementById("stream_quality") as HTMLInputElement;

  const EXIT_BUTTON = document.getElementById("exit") as HTMLInputElement;
  const CONFIRM_BUTTON = document.getElementById("confirm") as HTMLInputElement;

  if (event.source === window && event.data === "port") {
    let messagePort = event.ports[0];
    messagePort.onmessage = (event) => {
      // Update button focus
      if (typeof event.data === "object" && "isFocused" in event.data) {
        Array.from(document.getElementsByTagName("button")).forEach((button) => {
          if (event.data.isFocused) {
            button.classList.remove("blurred");
          } else {
            button.classList.add("blurred");
          }
        });
        return;
      }

      // Normal message
      let oldValue: StreamSettings = event.data;

      // Update values
      STREAM_ENABLE_INPUT.checked = oldValue.streamEnable;
      STREAM_ID_INPUT.value = oldValue.streamId.toString();
      STREAM_QUALITY_INPUT.value = oldValue.streamQuality.toString();

      // Close function
      function confirm() {
        if (STREAM_ID_INPUT.value === "") {
          alert("Stream ID cannot be empty.");
          return;
        }
        if (isNaN(Number(STREAM_QUALITY_INPUT.value))) {
          alert("Stream quality must be a number.");
          return;
        }
        if (Number(STREAM_QUALITY_INPUT.value) < 0 || Number(STREAM_QUALITY_INPUT.value) > 1) {
          alert("Stream quality must be between 0 and 1.");
          return;
        }
        // The first element is the old value to update valid streams, the second element is the new value to be set
        let value = {
          oldStream: oldValue,
          newStream: {
            streamEnable: Boolean(STREAM_ENABLE_INPUT.checked),
            streamId: String(STREAM_ID_INPUT.value),
            streamQuality: Number(STREAM_QUALITY_INPUT.value)
          } as StreamSettings
        };
        messagePort.postMessage(value);
      }

      // Set up exit triggers
      EXIT_BUTTON.addEventListener("click", () => {
        messagePort.postMessage({
          oldStream: oldValue,
          newStream: oldValue
        });
      });
      CONFIRM_BUTTON.addEventListener("click", confirm);
      window.addEventListener("keydown", (event) => {
        if (event.code === "Enter") confirm();
      });
    };
  }
});
