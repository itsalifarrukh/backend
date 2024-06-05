import { asyncHandler } from "../utils/asyncHandler.js";

const registreUser = asyncHandler(async (req, res) => {
   res.status(200).json({
      message: "OK",
   });
});

export { registreUser };
