const express = require('express');
const router = express.Router();

module.exports = function(client, connectToDatabase) {
    router.get("/:imageLabel", async (req, res) => {
        console.log("GET /purchase/:imageLabel triggered");

        try {
            const imageLabel = req.params.imageLabel;
            console.log("GET purchase for: " + imageLabel);

            connectToDatabase();
            const database = client.db("dbs");
            const purchaseDB = database.collection("Gallery");
            
            const selectedImage = await purchaseDB.findOne({filename: imageLabel + ".jpg"});

            if (!selectedImage) { // if no image is found
                return res.status(404).send("Image not found");
            }

            res.render("purchase", {
                image: selectedImage,
                username: req.MySession ? req.MySession.user : null 
            });
        } catch (error) {
            console.error(error);
            res.status(500).send("Error loading purchase page");
        }
    });

    router.post('/buy/:filename', async (req, res) => {
        console.log("POST /purchase/buy/:filename triggered");
        try {
            const filename = req.params.filename;
            connectToDatabase();
            const database = client.db("dbs");
            const purchaseDB = database.collection("Gallery");

            // verify the item exists AND is available ('A')
            const item = await purchaseDB.findOne({ 
                filename: filename, 
                status: "A" 
            });

            if (!item) { // if no item is found
                return res.status(400).send("Error: This item is no longer available for purchase.");
            }

            // perform the update to database
            await purchaseDB.updateOne(
                { filename: filename },
                { $set: { 
                    status: 'S', 
                    purchaser: req.MySession.user, // Record who bought it
                    date: new Date().toISOString() // datestamp
                }}
            );

            res.redirect("/pictures");
            
        } catch (error) {
            console.error("Security/DB Error:", error);
            res.status(500).send("Internal Server Error");
        }
    });

    return router;
};