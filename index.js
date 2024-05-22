import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import "dotenv/config";
import { User } from "./Database/user.js";
import Post from "./Database/post.js";
import Comment from "./Database/comment.js";
import validator from "email-validator";
import bcrypt from "bcrypt";
import sendMail from "./mailer.js";
import jwt from "jsonwebtoken";
import cookieParser  from 'cookie-parser';
import session from 'express-session';
import MongoStore from "connect-mongo";
import processComments from "./toxicheckmodel.js"; 
import fs from "fs";
import multer from "multer";
import path from 'path';

const app = express();
app.use(cors());
mongoose.connect(process.env.URL).then(console.log("Connected!"));


app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: 'session',
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({
    mongoUrl: process.env.URL
  }),
  //cookie: { maxAge: new Date ( Date.now() + (3600000) ) } 
}));

app.use(express.static("public"));
app.use(express.static("images"));

app.use((req, res, next) => {
  res.locals.success_msg = req.session.success_msg || null;
  res.locals.error_msg = req.session.error_msg || null;
  delete req.session.success_msg;
  delete req.session.error_msg;
  next();
});

const authMiddleware = (req, res, next ) => {
  const token = req.cookies.token;

  if(!token) {
    return res.redirect("/login");
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.userId = decoded.userId;
    next();
  } catch(error) {
    res.status(401).json( { message: 'Unauthorized'} );
  }
}

const passwordResetFlowMiddleware = (req, res, next) => {
  if (!req.session.user_email && req.path !== '/forget-password') {
    return res.redirect('/forget-password');
  } 
  if (req.path === '/verify-code' && !req.session.code) {
    return res.redirect('/forget-password');
  }
  if (req.path === '/change-password' && (!req.session.code || !req.session.user_email)) {
    return res.redirect('/forget-password');
  }
  next();
}

app.get("/", authMiddleware, async (req, res) => {
  try {
    const posts = await Post.find({});
    const name = req.session.user.name
    const role = req.session.user.role
    res.render("home", { posts: posts, role: role, name: name});
  } catch (error) {
    req.session.error_msg = error.message;
    res.redirect("/");
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "images"); 
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({ storage }).single('post_image');

app.get("/about", async(req, res) =>{
  res.render("about");
});

app.get("/contact", async(req, res) =>{
  res.render("contact");
});

//user registration
app.get("/signup", async(req, res) => {
  res.render("register");
});



app.post("/signup", async (req, res) => {
  const { user_name, user_email, user_password } = req.body;
  try {
    if (user_name === "" || user_email === "" || user_password === "")
      throw new Error("Enter value for all fields.");
    if (!validator.validate(user_email))
      throw new Error("Invalid Email.");

    const passwordRegex = /^(?=.*[0-9])(?=.*[@#])[a-zA-Z0-9@#]{8,}$/;
    if (!passwordRegex.test(user_password))
      throw new Error("Password must be at least 8 characters long, include at least one number, and one symbol like @ or #.");

    const encryptedPassword = await bcrypt.hash(user_password, 10);
    const user = await User.create({
      ...req.body,
      user_password: encryptedPassword,
      user_role: "admin",
    });
    req.session.success_msg = "Registration successful. Please log in.";
    res.redirect("/login");
  } catch (error) {
    req.session.error_msg = error.message;
    res.redirect("/signup");
  }
});
//user login
app.get("/login", async(req, res) => {
  res.render("login");
});



app.post("/login", async (req, res) => {
  const { user_email, user_password } = req.body;
  try {
    const validUser = await User.findOne({ user_email: user_email });
    if (!validUser || !(await bcrypt.compare(user_password, validUser.user_password))) {
      throw new Error("Invalid Credentials.");
    }

    const token = jwt.sign({ userId: validUser._id }, process.env.ACCESS_TOKEN_SECRET);
    req.session.user = { id: validUser._id, name: validUser.user_name, role: validUser.user_role };
    res.cookie('token', token, { httpOnly: true });
    req.session.success_msg = "Login successful.";
    res.redirect("/");
  } catch (error) {
    req.session.error_msg = error.message;
    res.redirect("/login");
  }
});

function generateRandomNumber() {
  return Math.floor(Math.random() * 900000) + 100000;
}

app.get("/forget-password", async (req, res) => {
  res.render("forgetpassword");
});

//forget password
app.post("/forget-password", async (req, res) => {
  try {
    const randomNumber = generateRandomNumber();
    const user_email = req.body.user_email;

    if (!validator.validate(user_email)) {
      throw new Error("Invalid Email.");
    }

    const emailFound = await User.findOne({ user_email: user_email });
    if (!emailFound) {
      throw new Error("Email not found");
    }

    await sendMail(randomNumber, user_email);
    req.session.code = { code: randomNumber };
    req.session.user_email = { email: user_email };
    req.session.success_msg = "Email sent successfully.";
    res.redirect("/verify-code");
  } catch (error) {
    req.session.error_msg = error.message;
    res.redirect("/forget-password");
  }
});

app.get("/verify-code", passwordResetFlowMiddleware, async (re, res) => {
  res.render("verifycode");
});

app.post("/verify-code", passwordResetFlowMiddleware, async (req, res) => {
  try {
    const validCode = JSON.stringify(req.session.code.code);
    const providedCode = req.body.verificationcode;
    if (validCode !== providedCode) {
      throw new Error("Invalid Code.");
    }
    res.redirect("/change-password");
  } catch (error) {
    req.session.error_msg = error.message;
    res.redirect("/verify-code");
  }
});


app.get("/change-password", passwordResetFlowMiddleware, async (re, res) => {
  res.render("changepassword");
});

// change password
app.post("/change-password", passwordResetFlowMiddleware, async (req, res) => {
  const password = req.body.new_password;
  const confirm_password = req.body.confirm_password;
  const user_email = req.session.user_email.email;
  try {
    if (password !== confirm_password)
      throw new Error("Passwords do not match");

    const passwordRegex = /^(?=.*[0-9])(?=.*[@#])[a-zA-Z0-9@#]{8,}$/;
    if (!passwordRegex.test(confirm_password))
      throw new Error("Password must be at least 8 characters long, include at least one number, and one symbol like @ or #.");

    // res.json("done");
    const encryptedPassword = await bcrypt.hash(confirm_password, 10);

    await User.updateOne(
		  { user_email: user_email },
		  {
			  user_password: encryptedPassword,
		  }
	);
  req.session.success_msg = "Password changed successfully.";
  res.redirect("/login") 
} catch (error) {
  req.session.error_msg = error.message;
  res.redirect("/change-password");
}
   
});

// logout
app.get('/logout', (req, res) => {
  res.clearCookie('token');
  req.session.success_msg = "Loged Out successfully.";
  res.redirect('/login');
});

app.get("/newposts", async (req, res) => {
  res.render("addpost");
});

//create post
app.post("/newposts", upload, async (req, res) => {
  try {
    await Post.create({
      post_title: req.body.post_title,
      post_body: req.body.post_body,
      post_image: req.file.filename,
    });
    req.session.success_msg = "New Post Created.";
    res.redirect("/");
  } catch (error) {
    req.session.error_msg = `Error: ${error.message}`;
  } 
});

function getCommentClass(predictions) {
  const classes = [];
  if (predictions[0] > 0.5) classes.push('toxic');
  if (predictions[1] > 0.5) classes.push('severe-toxic');
  if (predictions[2] > 0.5) classes.push('threat');
  if (predictions[3] > 0.5) classes.push('insult');
  if (predictions[4] > 0.5) classes.push('identity_hate');
  return classes.join(' ');
}


function formatPredictions(predictions) {
  const labels = ["toxic", "severe-toxic", "threat", "insult", "identity_hate"];
  return labels.map((label, index) => `${label}: ${predictions[index].toFixed(2)}`).join(', ');
}


//get specific post
app.get('/posts/:postId', async (req, res) => {
  try {
    const postId = req.params.postId;
    const role = req.session.user.role
    const post = await Post.findById(postId).populate({
      path: 'post_comments',
      select: 'comment_body comment_user _id' 
    }).lean();

    if (!post) {
      throw new Error('Post not found');
    }
    const commentsWithPredictions = await processComments(post.post_comments);
    const filteredComments = commentsWithPredictions.filter(c => c.post_id && c.post_id.toString() === postId);
    post.post_comments = filteredComments; 
    res.render('post', {
      post,
      role,
      getCommentClass, 
      formatPredictions 
    }); 

  } catch (error) {
    req.session.error_msg = `Error: ${error.message}`;
    res.redirect("/");
  }
});






//edit post
app.get("/posts/:postId/edit", async(req, res) => {
    try {
        const requestedPostId = req.params.postId;
        const post = await Post.findOne({_id: requestedPostId}).exec();

        if (!post) {
          throw new Error("Post not found");
        }      
        res.render("edit", { post });
    } catch (error) {
      req.session.error_msg = `Error: ${error.message}`;
      res.redirect("/");
    }
})


app.post("/posts/:id", upload, async (req, res) => {
  const postId = req.params.id;
  const newImage = req.file ? req.file.filename : req.body.old_image;
  const { title, content } = req.body;
  try {
    await Post.findByIdAndUpdate(
      postId,
      { post_title: title, post_body: content, post_image: newImage, },
      { new: true }
    );

    if (req.file) {
      try {
        fs.unlinkSync(`images/${req.body.old_image}`);
      } catch (err) {
        req.session.error_msg = err;
      }
    }
    req.session.success_msg = "Post has been edited.";
    res.redirect("/");
  } catch (error) {
    req.session.error_msg = `Error: ${error.message}`;
    res.redirect("/")
  }
});


//delete post
app.post('/delete/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      throw new Error('Post not found');
    }
    await Comment.deleteMany({ post_id: post._id });

    await Post.findByIdAndDelete(post._id);
    req.session.success_msg = "Post has been deleted.";
    res.redirect('/');
  } catch (error) {
    req.session.error_msg = `Error: ${error.message}`;
    res.redirect("/");
  }
});

//add comment
app.post('/post/:postId/comments', async (req, res) => {
  const { comment_body} = req.body;
  const postId = req.params.postId;
  try {
    // Create a new comment
    const comment = await Comment.create({ comment_body, post_id: postId, comment_user: req.session.user.name});
    
    const post = await Post.findById(postId);
    post.post_comments.push(comment._id);  
    await post.save();
    req.session.success_msg = "Comment added successful.";
    res.redirect(`/posts/${postId}`);
  } catch (error) {
    req.session.error_msg = `Error posting comment: ${error.message}`;
    res.redirect(`/posts/${postId}`);
  }
});

//delete comment
app.post('/posts/:postId/delete-comment', async (req, res) => {
  const { postId } = req.params;
  const { commentId } = req.body; 
  try {
    await Comment.findByIdAndDelete(commentId);

    const post = await Post.findById(postId);
    post.post_comments.pull(commentId);
    await post.save();
    req.session.success_msg = "Comment deleted successfully.";
    res.redirect(`/posts/${postId}`);
  } catch (error) {
    req.session.error_msg = `Error deleting comment: ${error.message}`;
    res.redirect(`/posts/${postId}`);
  }
});

app.listen(3000, () => {
  console.log('Server is running at http://localhost:3000');
});
