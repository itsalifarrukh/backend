import { v2 as cloudinary } from "cloudinary";
import ApiError from "./ApiError.js";
const deleteFromCloudinary = async (publicId) => {
   try {
      await cloudinary.uploader.destroy(publicId);
   } catch (error) {
      throw new ApiError(500, "Error while deleting old image from Cloudinary");
   }
};

export { deleteFromCloudinary };
