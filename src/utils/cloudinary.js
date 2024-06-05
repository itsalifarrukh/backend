import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
   api_key: process.env.CLOUDINARY_API_KEY,
   api_secret: process.env.CLOUDINARY_API_SECRET_KEY,
});

const uploadOnCloudinary = async (localFilePath) => {
   try {
      if (!localFilePath) return null;
      // upload file on clouadinary
      const response = await cloudinary.uploader.upload(localFilePath, {
         resource_type: "auto",
      });
      // file has been uplaoded successfully
      console.log("File is Uploaded on Cloudinary", response.url);
      return response;
   } catch (error) {
      fs.unlinkSync(localFilePath); // remove the locally stored temporary file as the uplaod operation got failed
      return null;
   }
};

export { uploadOnCloudinary };
