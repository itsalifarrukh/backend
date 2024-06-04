// require("dotenv").config({ path: "./env" });
import dotenv from "dotenv";
import connectDB from "./db/index.js";

dotenv.config({
   path: "./env",
});

connectDB();

/*
import express from "express";
const app = express()(async () => {
   try {
      mongoose.connect(`${process.env.MOGODB_URI}/${DB_NAME}`);
      app.on("Error", () => {
         console.log("ERROR: ", error);
         throw err;
      });
      app.listen(process.env.PORT, () => {
         console.log(`App is listening on Port ${process.env.PORT}`);
      });
   } catch (error) {
      console.log("ERROR: ", error);
      throw err;
   }
})();
*/
