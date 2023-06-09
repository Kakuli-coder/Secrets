require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const AppError = require("./AppError");
const User = require("./models/user");
const session = require("cookie-session");
const passport = require("passport");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const homeURL = "https://secrets-srl6.onrender.com";

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(User.createStrategy());
passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, {
            id: user.id,
            username: user.username,
            picture: user.picture
        });
    });
});
passport.deserializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${homeURL}/auth/google/secrets`,
    userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
},
    function (accessToken, refreshToken, profile, cb) {
        // console.log(profile);
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: `${homeURL}/auth/facebook/secrets`
},
    function (accessToken, refreshToken, profile, cb) {
        // console.log(profile);
        User.findOrCreate({ facebookId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("Connected successfully to Mongo!");
    }).catch((err) => {
        console.log("Mongo Connection error!", err);
    });

function wrapAsync(fn) {
    return function (req, res, next) {
        fn(req, res, next).catch(e => next(e));
    };
};

app.get("/", (req, res) => {
    res.render("home");
});

app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile"] })
);

app.get("/auth/google/secrets",
    passport.authenticate("google", { failureRedirect: "/login" }),
    function (req, res) {
        // Successful authentication, redirect secrets.
        res.redirect("/secrets");
    });

app.get("/auth/facebook",
    passport.authenticate("facebook"));

app.get("/auth/facebook/secrets",
    passport.authenticate("facebook", { failureRedirect: "/login" }),
    function (req, res) {
        // Successful authentication, redirect secrets.
        res.redirect("/secrets");
    });

app.get("/register", (req, res) => {
    res.render("register");
});

app.get("/secrets", wrapAsync(async (req, res, next) => {
    const usersWithSecret = await User.find({ secret: { $ne: null } });
    res.render("secrets", { usersWithSecret });
}));

app.get("/submit", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    };
});

app.post("/submit", wrapAsync(async (req, res) => {
    const submittedSecret = req.body.secret;
    // console.log(req.user);
    const id = req.user.id;
    const foundUser = await User.findById(id);
    foundUser.secret = submittedSecret;
    await foundUser.save();
    res.redirect("/secrets");
}));

app.post("/register", (req, res, next) => {
    const { username, password } = req.body;
    User.register({ username: username }, password, (err, user) => {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            });
        };
    });
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", (req, res, next) => {
    const { username, password } = req.body;
    const user = new User({ username, password });
    req.login(user, (err) => {
        if (err) {
            return next(err);
        };
        passport.authenticate("local")(req, res, () => {
            res.redirect("/secrets");
        });
    });
});

app.post('/logout', (req, res) => {
    req.logout();
    res.redirect('/');
});

app.use((err, req, res, next) => {
    const { status = 500, message = "Something went wrong!" } = err;
    res.status(status).send(message);
});

app.listen(process.env.PORT, () => {
    console.log(`Server is runnig on port ${process.env.PORT}.`);
});
