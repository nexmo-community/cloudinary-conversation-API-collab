let activeConversation;

function setupConversation(apiPath) {
  fetch(apiPath) /* To generate the JWT for the agent */
    .then(function(response) {
      return response.json();
    })
    .then(function(response) {
      new NexmoClient({
        debug: false
      })
        .login(response.jwt) /* Used to log into Nexmo */
        .then(app => {
          console.log("*** Logged into app", app);
          return app.getConversation(
            response.conversation.id
          ); /* Grabs conversation from Nexmo's server */
        })
        .then(conversation => {
          console.log("*** Retrieved conversations", conversation);
          activeConversation = conversation;
          setupListeners();
        })
        .catch(console.error);
    });
}

function setupListeners() {
  const form = document.getElementById("textentry");
  const textbox = document.getElementById("textbox");

  activeConversation.on("text", (sender, message) => {
    console.log(sender, message);
    appendMessage(
      message.body.text,
      `${sender.user.name === "agent" ? "agent" : "input"}`
    );
  });

  form.addEventListener(
    "submit",
    event => {
      event.preventDefault();
      event.stopPropagation();
      const inputText = textbox.value;
      activeConversation.sendText(inputText);
      textbox.value = "";
    },
    false
  );
}

let messageId = 0;

function appendMessage(message, sender, appendAfter) {
  const messageDiv = document.createElement("div");
  messageDiv.classList = `message ${sender}`;
  messageDiv.innerHTML = "<p>" + message + "</p>";
  messageDiv.dataset.messageId = messageId++;

  const messageArea = document.getElementById("message-area");
  if (appendAfter == null) {
    messageArea.appendChild(messageDiv);
  } else {
    const inputMsg = document.querySelector(
      `.message[data-message-id='${appendAfter}']`
    );
    inputMsg.parentNode.insertBefore(messageDiv, inputMsg.nextElementSibling);
  }

  messageArea.scroll({
    /* Scroll the message area to the bottom. */
    top: messageArea.scrollHeight,
    behavior: "smooth"
  });

  return messageDiv.dataset
    .messageId; /* Return this message id so that a reply can be posted to it later */
}
