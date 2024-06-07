import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

export { registreUser, loginUser, logoutUser };
