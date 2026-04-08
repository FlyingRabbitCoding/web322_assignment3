/* 
// Assignment 03 - pictures
Class:  WEB322
Author:  billie wu
Student number:  134561232

example: https://george-tsang-gallery3-4dad555b5591.herokuapp.com/

*/


const HTTP_PORT = process.env.PORT || 3000;
const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');
const clientSession = require("client-sessions");
const randomstring = require("randomstring");
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://assignmentuser:GO5OGR3DoIVHIUjA@cluster0.acntyy2.mongodb.net/?appName=Cluster0";
const app = express();

let users = [];
let cachedDb = null;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// fix for vercel caching the connection
async function connectToDatabase() {
    if (cachedDb) return cachedDb; // Use existing connection
    //   const client = await MongoClient.connect(process.env.MONGODB_URI);
    const tempCache = await client.connect();
    cachedDb = tempCache;
    return client;
}

const purchaseRouter = require('./routes/purchase')(client, connectToDatabase);

async function run() {
    try {
        // await client.connect();
        connectToDatabase();
        console.log("Connected to MongoDB Atlas");
        const db = client.db('dbs');
        users = await db.collection("Users").find({}).toArray();
    } catch (err) {
        console.log("Initial connection error:", err);
    }
}

run().catch(console.dir);

app.set('views', path.join(__dirname, 'views'));

app.engine('hbs', exphbs.engine({
    extname: '.hbs',
    defaultLayout: false,
    partialsDir: path.join(__dirname, 'views', 'partials')
}));

app.set('view engine', 'hbs');


app.use(clientSession({
    cookieName: "MySession",
    secret: randomstring.generate(),
    duration: 1 * 60 * 1000,
    activeDuration: 1 * 60 * 1000,
    httpOnly: true,
    secure: false,     
    ephemeral: true
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function checkL(req, res, next) {
    if (!req.MySession.user || req.MySession.user === "Unknown") {
        res.redirect("/");
    } else {
        next();
    }
}

app.get("/", (req, res) => {
    req.MySession.user = "Unknown";

    res.render("login", {
        data: {
            usernamefromcookie: "TBD",
            usernamefromtextbox: "TBD"
        }
    });
});

app.post("/login", async (req, res) => {
    const email = req.body.username1;
    const password = req.body.password1;
    const targetUser = users.find(u => u.user === email);

    if (targetUser) {
        if (targetUser.password === password) {
            try {
                // 1. Access the database
                connectToDatabase();
                const db = client.db('dbs');
                
                // 2. Reset all documents in the 'Gallery' collection
                // Sets status to "A" and removes purchaser/date fields
                await db.collection("Gallery").updateMany(
                    {}, 
                    { 
                        $set: { status: "A" },
                        $unset: { purchaser: "", date: "" } 
                    }
                );

                console.log("Database reset: All statuses set to 'A'");

                // 3. Set the session and redirect
                req.MySession.user = email;
                return res.redirect("/pictures");

            } catch (err) {
                console.error("Error resetting database on login:", err);
                return res.status(500).send("Internal Server Error during login reset.");
            }
        } else {
            return res.render("login", {
                data: { lblMessage: "Invalid password" }
            });
        }
    } else {
        return res.render("login", {
            data: { lblMessage: "Not a registered username" }
        });
    }
});

app.get("/pictures", checkL, async (req, res) => {
    try {
        connectToDatabase();
        const db = client.db('dbs');
        // Fetch only available images directly from the DB
        const availableImages = await db.collection("Gallery").find({ status: "A" }).toArray();

        const formattedImages = availableImages.map(img => {
            return {
                ...img,
                label: img.filename.split('.')[0], // grab just the name portion without the .jpg extension
                selected: false 
            };
        });

        res.render("pictures", {
            data: { username: req.MySession.user },
            images: formattedImages,
            displayImage: "/images2/store.jpg"
        });
    } catch (err) {
        res.status(500).send("Error retrieving images from database.");
    }
});

app.post("/pictures", checkL, async (req, res) => {
    try {
        const choice = (req.body && req.body.option) ? req.body.option : "";
        connectToDatabase();
        const db = client.db('dbs');
        
        // Reload the current available list
        const availableImages = await db.collection("Gallery").find({ status: "A" }).toArray();
        const selectedImage = availableImages.find(img => img.filename === choice);

        res.render("pictures", {
            data: { username: req.MySession.user },
            images: availableImages.map(img => ({
                ...img,
                label: img.filename.split('.')[0],
                selected: img.filename === choice
            })),
            displayImage: choice ? "/images2/" + choice : "/images2/garfield.jpg",
            selectedLabel: selectedImage ? selectedImage.filename.split('.')[0] : ""
        });
    } catch (err) {
        res.status(500).send("Error processing selection.");
    }
});

app.get("/logout", (req, res) => {
    req.MySession.reset(); // Clears the client-session
    res.redirect("/"); // Takes you back to the login page
});

app.listen(HTTP_PORT, () => {
    console.log(`Server running: http://localhost:${HTTP_PORT}`);
});

app.use('/purchase', checkL, purchaseRouter, connectToDatabase);

app.use((req, res) => {
    res.status(404).send("Page Not Found");
});
