require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = 3000;
const rug = require("username-generator");
var cloudinary = require("cloudinary").v2;
var screenshot = require("desktop-screenshot");
// const fs = require("fs");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET
});

const Nexmo = require("nexmo");
const nexmo = new Nexmo(
  {
    apiKey: process.env.NEXMO_API_KEY,
    apiSecret: process.env.NEXMO_API_SECRET,
    applicationId: process.env.NEXMO_APPLICATION_ID,
    privateKey: __dirname + process.env.NEXMO_PRIVATE_KEY_PATH
  },
  { debug: true }
);

const ACL = {
  /* For controlling access on the following URLs, which are Nexmo API paths */
  paths: {
    "/*/users/**": {},
    "/*/conversations/**": {},
    "/*/sessions/**": {},
    "/*/devices/**": {},
    "/*/image/**": {},
    "/*/media/**": {},
    "/*/applications/**": {},
    "/*/push/**": {},
    "/*/knocking/**": {}
  }
}; /* Used for JWT generation with appropriate permissions */

app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true
  })
);
app.use(express.static("public"));

app.get("/", function(request, response) {
  response.sendFile(__dirname + "/views/index.html");
});

app.get("/agent", function(request, response) {
  response.sendFile(__dirname + "/views/agent.html");
});

let activeConversationDetails; /* Creates some pseudo in-memory persistence */
let agentMember;
app.route("/api/new").get((req, res) => {
  if (activeConversationDetails) {
    res.json(activeConversationDetails);
  } else {
    nexmo.users.create(
      /* Creates a new random user */
      {
        name: rug.generateUsername("-")
      },
      (error, user) => {
        if (error) console.log(error);

        if (user) {
          /* If user creation successful, create a new conversation */
          nexmo.conversations.create(
            {
              display_name: rug.generateUsername()
            },
            (error, conversation) => {
              if (error) console.log(error);

              if (conversation) {
                /* If conversation creation successful, add the newly created user to the conversation */
                nexmo.conversations.members.add(
                  conversation.id,
                  {
                    action: "join",
                    user_id: user.id,
                    channel: {
                      type: "app"
                    }
                  },
                  (error, member) => {
                    if (error) console.log(error);

                    if (member) {
                      /* If user was successfully added, then add the support agent */
                      nexmo.conversations.members.add(
                        conversation.id,
                        {
                          action: "join",
                          user_id: process.env.SUPPORT_AGENT,
                          channel: {
                            type: "app"
                          }
                        },
                        (error, agent) => {
                          if (error) console.log(error);
                          const jwt = Nexmo.generateJwt(
                            /* Generate JWT for random user, needed for logging into the client SDK */
                            __dirname + process.env.NEXMO_PRIVATE_KEY_PATH,
                            {
                              application_id: process.env.NEXMO_APPLICATION_ID,
                              sub: member.name,
                              exp: new Date().getTime() + 86400,
                              acl: ACL
                            }
                          );
                          if (agent) {
                            /* If agent was successfully added, then return active conversation details */
                            agentMember = agent.id;
                            activeConversationDetails = {
                              user,
                              conversation,
                              member,
                              agent,
                              jwt
                            };
                            res.json(activeConversationDetails);
                          }
                        }
                      );
                    }
                  }
                );
              }
            }
          );
        }
      }
    );
  }
});

app.route("/api/jwt/:user").get((req, res) => {
  const jwt = Nexmo.generateJwt(
    /* For programatically generating JWT */
    __dirname + process.env.NEXMO_PRIVATE_KEY_PATH,
    {
      application_id: process.env.NEXMO_APPLICATION_ID,
      sub: req.params.user,
      exp: new Date().getTime() + 86400,
      acl: ACL
    }
  );
  res.json({
    jwt: jwt,
    conversation: activeConversationDetails.conversation
  });
});

app.route("/webhooks/event").post((req, res) => {
  /* Gets all the events that happen on the application for debugging or further functionality devlopement */
  if (req.body.body.text == "screenshot") {
    screenshot("screenshot.png", function(error, complete) {
      if (error) console.log("Screenshot failed", error);
      else console.log("Screenshot succeeded");
    });

    cloudinary.uploader.upload(
      "screenshot.png",
      {
        tags: "screenshot",
        overlay: {
          font_family: "Arial",
          font_size: 50,
          text:
            "Conversation: " +
            req.body.conversation_id +
            "Timestamp: " +
            req.body.timestamp
        }
      },
      function(error, result) {
        console.log(result, error);
      }
    );
  }
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
