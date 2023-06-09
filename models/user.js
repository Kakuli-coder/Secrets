const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');
const findOrCreate = require("mongoose-findorcreate");

const userSchema = Schema({
    username: String,
    password: String,
    googleId: String,
    facebookId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

module.exports = User;
