/* Support page: the contact form writes an email in the visitor's own mail app. Nothing is sent from the page. */
(function () {
  var TO = "hello@earthmidi.com",
    f = document.getElementById("cf"),
    n = document.getElementById("cfNote");
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    var m = f.message.value.trim();
    if (!m) {
      n.textContent = "Add a message first.";
      f.message.focus();
      return;
    }
    var body =
      m +
      "\n\n" +
      (f.name.value.trim() ? "From: " + f.name.value.trim() + "\n" : "") +
      (f.device.value.trim() ? "Device: " + f.device.value.trim() + "\n" : "") +
      "Sent from earthmidi.com/support";
    location.href =
      "mailto:" +
      TO +
      "?subject=" +
      encodeURIComponent("Earth MIDI: " + f.topic.value) +
      "&body=" +
      encodeURIComponent(body);
    n.textContent = "Your mail app should open now. If it doesn't, write to " + TO + ".";
  });
  document.getElementById("cfCopy").addEventListener("click", function () {
    (navigator.clipboard ? navigator.clipboard.writeText(TO) : Promise.reject()).then(
      function () {
        n.textContent = "Copied.";
      },
      function () {
        n.textContent = TO;
      },
    );
  });
})();
