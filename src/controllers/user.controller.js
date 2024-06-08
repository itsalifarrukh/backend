import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { deleteFromCloudinary } from "../utils/deleteFromCloudinary.js";

const generateAccessAndRefreshTokens = async (userId) => {
   try {
      const user = await User.findById(userId);
      const accessToken = user.generateAccessToken();
      const refreshToken = user.generateRefreshToken();
      user.refreshToken = refreshToken;
      await user.save({ validateBeforeSave: false });
      return { accessToken, refreshToken };
   } catch (error) {
      throw new ApiError(
         500,
         "Something went Wrong while Generating Access & Refresh Token"
      );
   }
};

const registreUser = asyncHandler(async (req, res) => {
   // get user details from frontend
   // validation - not empty
   // check if user already exists: username, email
   // check for images, check for avatar
   // upload them to cloudinary, avatar
   // create user object - create entry in db
   // remove password and refresh token field from response
   // check for user creation
   // return response
   // get user details from frontend

   const { fullName, email, username, password } = req.body;
   // console.log("Email:", email);
   // if (fullName === "") {
   //    throw new ApiError(400, "Full Name is Required")
   // }

   // validation - not empty
   if (
      [fullName, email, username, password].some(
         (field) => field?.trim() === ""
      )
   ) {
      throw new ApiError(400, "All Fields are Required");
   }
   // check if user already exists: username, email
   const existedUser = await User.findOne({
      $or: [{ username }, { email }],
   });
   if (existedUser) {
      throw new ApiError(
         409,
         "User with this Email or Username already Exists"
      );
   }
   // console.log(req.files);
   // check for images, check for avatar
   const avatarLocalPath = req.files?.avatar[0]?.path;
   // const coverImageLocalPath = req.files?.coverImage[0]?.path;
   let coverImageLocalPath;
   if (
      req.files &&
      Array.isArray(req.files.coverImage) &&
      req.files.coverImage.length > 0
   ) {
      coverImageLocalPath = req.files.coverImage[0].path;
   }
   if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar Image is Required");
   }
   // upload them to cloudinary, avatar
   const avatar = await uploadOnCloudinary(avatarLocalPath);
   const coverImage = await uploadOnCloudinary(coverImageLocalPath);

   if (!avatar) {
      throw new ApiError(400, "Avatar Image is Required");
   }
   // create user object - create entry in db
   const user = await User.create({
      fullName,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username: username.toLowerCase(),
   });
   // remove password and refresh token field from response
   const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
   );
   // check for user creation
   if (!createdUser) {
      throw new ApiError(500, "Something went Wrong while Registring the User");
   }
   // get user details from frontend
   return res
      .status(201)
      .json(new ApiResponse(200, createdUser, "User Registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
   // request body => data
   // username or email
   // find the user
   // password checking
   // access and refresh token generate
   // send cookies
   // return login successfully

   // request body => data
   const { username, email, password } = req.body;
   console.log(email);
   // username or email
   //  Here is the logic if you want to find user with its username or email:
   if (!username && !email) {
      throw new ApiError(400, "Username or Email is Required");
   }
   // Here is the logic if you want to find user with both email and useranme
   // if (!(username || email)) {
   //    throw new ApiError(400, "username or email is required");
   // }

   // find the user
   const user = await User.findOne({
      $or: [{ username }, { email }],
   });
   if (!user) {
      throw new ApiError(404, "User does not Exist");
   }
   // password checking
   const isPasswordValid = await user.isPasswordCorrect(password);
   if (!isPasswordValid) {
      throw new ApiError(401, "Username or Password is Incorrect");
   }
   // access and refresh token generate
   const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
   );
   const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken"
   );
   // send cookies
   const options = {
      httpOnly: true,
      secure: true,
   };
   // return login successfully
   return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
         new ApiResponse(
            200,
            {
               user: loggedInUser,
               accessToken,
               refreshToken,
            },
            "User Logged In Successfully!"
         )
      );
});

const logoutUser = asyncHandler(async (req, res) => {
   User.findByIdAndUpdate(
      req.user._id,
      {
         $set: {
            refreshToken: undefined,
         },
      },
      {
         new: true,
      }
   );
   const options = {
      httpOnly: true,
      secure: true,
   };
   return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "User Logged Out Successfully!"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
   const incomingRefreshToken =
      req.cokkies.refreshToken || req.body.refreshToken;
   if (!incomingRefreshToken) {
      throw new ApiError(401, "Unauthorized Request");
   }
   try {
      const decodedToken = jwt.verify(
         incomingRefreshToken,
         process.env.REFRESH_TOKEN_SECRET
      );
      const user = await User.findById(decodedToken?._id);
      if (!user) {
         throw new ApiError(401, "Invalid Refresh Token");
      }
      if (incomingRefreshToken !== user?.refreshToken) {
         throw new ApiError(401, "Refresh Token is Expired or Used");
      }
      const options = {
         httpOnly: true,
         secure: true,
      };
      const { accessToken, newRefreshToken } =
         await generateAccessAndRefreshTokens(user._id);
      return res
         .status(200)
         .cookie("accessToken", accessToken, options)
         .cookie("refreshToken", newRefreshToken, options)
         .json(
            new ApiResponse(
               200,
               { accessToken, refreshToken: newRefreshToken },
               "Access Token Refreshed Successfully!"
            )
         );
   } catch (error) {
      throw new ApiError(401, error?.message || "Invalid Refresh Token");
   }
});

const changeCurretUserPassword = asyncHandler(async (req, res) => {
   const { oldPassword, newPassword, confirmPassword } = req.body;

   // Check if newPassword and confirmPassword match
   if (newPassword !== confirmPassword) {
      throw new ApiError(
         400,
         "New Password and Confirm Password must be the same"
      );
   }

   // Find the user by ID
   const user = await User.findById(req.user?._id);
   if (!user) {
      throw new ApiError(404, "User not found");
   }

   // Check if oldPassword is correct
   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
   if (!isPasswordCorrect) {
      throw new ApiError(400, "Invalid Old Password");
   }

   // Update the user's password
   user.password = newPassword;
   await user.save({ validateBeforeSave: false });

   // Return a success response
   return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password Changed Successfully!"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
   return res
      .status(200)
      .json(200, req.user, "Current User Fetched Succesfully");
});

const updateAccountDetails = asyncHandler(async (req, res) => {
   const { fullName, username } = req.body;

   // Create an update object dynamically based on the provided fields
   const updateFields = {};
   if (fullName) updateFields.fullName = fullName;
   if (username) updateFields.username = username;

   // Check if there is at least one field to update
   if (Object.keys(updateFields).length === 0) {
      throw new ApiError(400, "At least one field is required to update");
   }

   // Update the user with the provided fields
   const user = await User.findByIdAndUpdate(
      req.user?._id,
      { $set: updateFields },
      { new: true }
   ).select("-password");

   if (!user) {
      throw new ApiError(404, "User not found");
   }

   return res
      .status(200)
      .json(
         new ApiResponse(200, user, "Account Details Updated Successfully!")
      );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
   // Get the local path of the uploaded avatar file
   const avatarLocalPath = req.file?.path;
   if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar File is Missing");
   }

   // Upload the avatar to Cloudinary
   const avatar = await uploadOnCloudinary(avatarLocalPath);
   if (!avatar.url) {
      throw new ApiError(400, "Error while Uploading Avatar");
   }

   // Find the user by their ID
   const user = await User.findById(req.user?._id);
   if (!user) {
      throw new ApiError(404, "User not found");
   }

   // Save the old avatar URL for later deletion
   const oldAvatarUrl = user.avatar;

   // Update the user's avatar URL in the database
   const updatedUser = await User.findByIdAndUpdate(
      req.user?._id,
      { $set: { avatar: avatar.url } },
      { new: true }
   ).select("-password");

   // Delete the old avatar from Cloudinary if it exists
   if (oldAvatarUrl) {
      const oldAvatarPublicId = oldAvatarUrl.split("/").pop().split(".")[0]; // Extract public ID from old avatar URL
      await deleteFromCloudinary(oldAvatarPublicId);
   }

   // Respond with a success message and the updated user data
   return res
      .status(200)
      .json(
         new ApiResponse(200, updatedUser, "Avatar File Updated Successfully")
      );
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
   // Get the local path of the uploaded cover image file
   const coverImageLocalPath = req.file?.path;
   if (!coverImageLocalPath) {
      throw new ApiError(400, "Cover Image is Missing");
   }

   // Upload the cover image to Cloudinary
   const coverImage = await uploadOnCloudinary(coverImageLocalPath);
   if (!coverImage.url) {
      throw new ApiError(400, "Error while Uploading Cover Image");
   }

   // Find the user by their ID
   const user = await User.findById(req.user?._id);
   if (!user) {
      throw new ApiError(404, "User not found");
   }

   // Save the old cover image URL for later deletion
   const oldCoverImageUrl = user.coverImage;

   // Update the user's cover image URL in the database
   const updatedUser = await User.findByIdAndUpdate(
      req.user?._id,
      { $set: { coverImage: coverImage.url } },
      { new: true }
   ).select("-password");

   // Delete the old cover image from Cloudinary if it exists
   if (oldCoverImageUrl) {
      const oldCoverImagePublicId = oldCoverImageUrl
         .split("/")
         .pop()
         .split(".")[0]; // Extract public ID from old cover image URL
      await deleteFromCloudinary(oldCoverImagePublicId);
   }

   // Respond with a success message and the updated user data
   return res
      .status(200)
      .json(
         new ApiResponse(200, updatedUser, "Cover Image Updated Successfully")
      );
});

// Importing required modules or dependencies
const getUserChannelProfile = asyncHandler(async (req, res) => {
   // Destructuring username from request parameters
   const { username } = req.params;

   // Checking if username is missing or empty
   if (!username?.trim()) {
      // Throwing an error if username is missing
      throw new ApiError(400, "Username is Missing");
   }

   // Aggregating user data from User collection
   const channel = await User.aggregate([
      {
         // Matching documents based on provided username (case-insensitive)
         $match: {
            username: username?.toLowerCase(),
         },
      },
      {
         // Performing a lookup to fetch subscribers of the user
         $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "channel",
            as: "subscribers",
         },
      },
      {
         // Performing a lookup to fetch channels subscribed to by the user
         $lookup: {
            from: "subscriptions",
            localField: "_id",
            foreignField: "subscriber",
            as: "subscribedTo",
         },
      },
      {
         // Adding new fields to the documents
         $addFields: {
            // Counting the number of subscribers
            subscribersCount: {
               $size: "$subscribers",
            },
            // Counting the number of channels subscribed to by the user
            channelSubcribedToCount: {
               $size: "$subscribedTo",
            },
            // Checking if the current user is subscribed to this channel
            isSubscribed: {
               $cond: {
                  // Using conditional operator to check if the user ID is in the subscribers list
                  if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                  then: true,
                  else: false,
               },
            },
         },
      },
      {
         // Projecting only required fields
         $project: {
            fullName: 1,
            username: 1,
            subscribersCount: 1,
            channelSubcribedToCount: 1,
            avatar: 1,
            coverImage: 1,
            email: 1,
         },
      },
   ]);

   // If no channel is found with the provided username, throwing a 404 error
   if (!channel?.length) {
      throw new ApiError(404, "Channel does not Exist");
   }

   // Logging the channel data for debugging purposes
   console.log(channel);

   // Returning the fetched channel data as a JSON response
   return res
      .status(200)
      .json(
         new ApiResponse(200, channel[0], "User Channel Fetched Successfully!")
      );
});

// Importing required modules or dependencies
const getWatchHistory = asyncHandler(async (req, res) => {
   // Aggregating user data including watch history
   const user = await User.aggregate([
      {
         // Matching documents based on the user's _id
         $match: {
            _id: new mongoose.Types.ObjectId(req.user._id),
         },
      },
      {
         // Performing a lookup to fetch videos from the watch history
         $lookup: {
            from: "videos",
            localField: "watchHistory",
            foreignField: "_id",
            as: "watchHistory",
            pipeline: [
               {
                  // Performing a lookup to fetch owner details of each video
                  $lookup: {
                     from: "users",
                     localField: "owner",
                     foreignField: "_id",
                     as: "owner",
                     pipeline: [
                        {
                           // Projecting only required fields of the owner
                           $project: {
                              fullName: 1,
                              username: 1,
                              avatar: 1,
                           },
                        },
                     ],
                  },
               },
               {
                  // Adding a new field 'owner' which contains the details of the video owner
                  $addFields: {
                     owner: {
                        $first: "$owner",
                     },
                  },
               },
            ],
         },
      },
   ]);

   // Returning the watch history data as a JSON response
   return res
      .status(200)
      .json(
         new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch History Fetched Successfully!"
         )
      );
});

export {
   registreUser,
   loginUser,
   logoutUser,
   refreshAccessToken,
   changeCurretUserPassword,
   getCurrentUser,
   updateAccountDetails,
   updateUserAvatar,
   updateUserCoverImage,
   getUserChannelProfile,
   getWatchHistory,
};
