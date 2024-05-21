const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Pusher = require("pusher");
const url =
  "mongodb+srv://gmsk8011:gmsk8011@cluster0.t2fzzds.mongodb.net/userslist?retryWrites=true&w=majority&appName=Cluster0";
const { User, Message } = require("./models/data");

const app = express();
app.use(express.json());
app.use(bodyParser.json());
app.use(cors());

// Pusher configuration
const pusher = new Pusher({
  appId: "1804585",
  key: "5efc00b7acf5bd33ed7d",
  secret: "0c815601b26111b18e9b",
  cluster: "ap2",
  useTLS: true,
});

// Register endpoint
app.post("/register", async (req, res) => {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(req.body.password, salt);
    const newuser = {
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
    };
    const user = await User.create(newuser);
    res.status(201).send({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json(error);
  }
});

// Login endpoint
app.post("/login", async (req, res) => {
  const email = req.body.email;
  const user = await User.findOne({ email });
  if (user) {
    try {
      if (await bcrypt.compare(req.body.password, user.password)) {
        const token = jwt.sign({ name: user.name }, "secretkey");
        const currUser = user;
        res.status(200).json({ currUser: currUser, token });
      } else {
        res.status(401).json({ message: "Invalid password" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error" });
    }
  } else {
    res.status(401).send("User not found");
  }
});

app.post("/message", async (req, res) => {
  try {
    const { sender, receiver, msg } = req.body;
    console.log(req.body);
    // Ensure sender and receiver are valid users
    const senderUser = await User.findById(sender);
    const receiverUser = await User.findById(receiver);
    if (!senderUser || !receiverUser) {
      return res.status(400).json({ message: "Invalid sender or receiver ID" });
    }

    const newMessage = new Message({
      sender,
      receiver,
      msg,
    });

    const savedMessage = await newMessage.save();
    // Trigger Pusher event
    pusher.trigger("messages", "inserted", {
      sender: savedMessage.sender,
      receiver: savedMessage.receiver,
      msg: savedMessage.msg,
    });

    res.status(201).json(savedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/messages", async (req, res) => {
  const messages = await Message.find().sort({ createdAt: -1 });
  res.status(200).send({ messages });
});

app.get("/users", async (req, res) => {
  const users = await User.find({});
  res.status(200).send({ users });
});

// Protected route example
app.get("/protected", authenticateToken, (req, res) => {
  res.status(200).send("Welcome to the app");
});

function authenticateToken(req, res, next) {
  const token = req.headers["authorization"];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, "secretkey", (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

mongoose
  .connect(url)
  .then(() => {
    console.log("Connected to DB");
    app.listen(3000, () => {
      console.log("Server running on port 3000");
    });
  })
  .catch(() => {
    console.log("Connection failed");
  });
