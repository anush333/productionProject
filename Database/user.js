import mongoose from "mongoose";

const userSchema = {
    user_name: {
        type: String,
    },
    user_email: {
        type: String,
    },
    user_password: {
        type: String,
    },
    user_role: {
        type: String,
    },

  };

  const User = mongoose.model("User", userSchema);

  export { userSchema, User };