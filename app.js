const express = require('express');
const mysql = require('mysql2');
// use this for the team github thing
const path = require("path");
//******** TODO: Insert code to import 'express-session' *********//
const session = require('express-session');

const flash = require('connect-flash');
const multer = require('multer');

const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

// Local connection
//const db = mysql.createConnection({
//host: 'localhost',
//user: 'root',
//password: 'RP738964$',
//database: 'C237_usersdb'
// });

// [C237-025] Database connection to Azure MySQL Database
const connection = mysql.createConnection({
    host: 'c237-annie-mysql.mysql.database.azure.com',
    user: 'c237_025',
    password: 'c237025@2026!',
    database: 'c237_025_ca2team3',
    ssl: {
        rejectUnauthorized: false
    }
});


connection.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});

app.use(express.urlencoded({ extended: false }));
app.use(express.static('public'));
// use this for the team github thing
app.use("/images", express.static(path.join(__dirname, "images")));

// Setting up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

//******** TODO: Insert code for Session Middleware below ********//
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(flash());

//******** TODO: Create a Middleware to check if user is logged in. ********//
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};
//******** TODO: Create a Middleware to check if user is admin. ********//
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    }
};
// Routes
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user, messages: req.flash('success') });
});

app.get('/about', (req, res) => {
    res.render('about', { user: req.session.user });
});

app.get('/ourteam', (req, res) => {
    res.render('ourteam', { user: req.session.user });
});

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});


//******** TODO: Create a middleware function validateRegistration ********//
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact } = req.body;
    if (!username || !email || !password || !address || !contact) {
        return res.send('All fields are required.');
    }
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    //If all validations pass, the next function is called, allowing the request to proceed to the
    //next middleware function or route handler.
    next();
};

app.post('/about', (req, res) => {
    res.render('about', { user: req.session.user });
});

//******** TODO: Integrate validateRegistration into the register route. ********//
app.post('/register', validateRegistration, (req, res) => {
    //******** TODO: Update register route to include role. ********//
    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    connection.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

//******** TODO: Insert code for login routes to render login page below ********//
app.get('/login', (req, res) => {
    res.render('login', {
        //retrieve success and error messages from the flash middleware and
        //pass them to the login view for display.
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

//******** TODO: Insert code for login routes for form submission below ********//
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    // Validate email and password
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }
    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    connection.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }
        if (results.length > 0) {
            // Successful login
            req.session.user = results[0]; // store user in session
            req.flash('success', 'Login successful!');
            res.redirect('/dashboard');
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});
//******** TODO: Insert code for dashboard route to render dashboard page for users. ********//
app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.user });
});
//******** TODO: Insert code for admin route to render dashboard page for admin. ********//
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('admin', { user: req.session.user });
});

//******** TODO: Insert code for logout route ********//
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// //******** TODO: Insert code for adding an animal ********//
app.get('/addAnimal', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addProduct', { user: req.session.user });
});

app.post('/addAnimal', upload.single('image'), (req, res) => {
    // Extract product data from the request body
    const { animalName, species, injury, location } = req.body;
    let image;
    if (req.file) {
        image = req.file.filename; // Save only the filename
    } else {
        image = null;
    }

    const sql = 'INSERT INTO products (animalName, species, injury, image) VALUES (?, ?, ?, ?)';
    // Insert the new product into the database
    connection.query(sql, [animalName, species, injury, image], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error adding animal:", error);
            res.status(500).send('Error adding animal');
        } else {
            // Send a success response
            req.flash('success', 'Animal added successfully!');
            res.redirect('/animal');
            res.redirect('/inventory');
        }
    });
});
app.get('/addAppointment', checkAuthenticated, (req, res) => {
    res.render('addAppointment', {user: req.session.user } ); 
});
//Define a route to render the contact us page
app.get('/contact', (req, res) => {
    res.render('contact');
 
});

app.post('/contact', (req, res) => {
    const { name, email, contact, comments } = req.body;
    res.render('confirm', { name, email, contact, comments});
});

// define a route to render filtering
app.get('/filter', (req, res) => {
    const { rating, keyword } = req.query;
    let filteredCafes = cafes;
    if (rating && rating !== '') {
        filteredCafes = filteredCafes.filter(cafe => cafe.rating >= Number(rating));
    }
    if (keyword && keyword.trim() !== "") {
        const lowerKeyword = keyword.trim().toLowerCase();
        filteredCafes = filteredCafes.filter(cafe => {
            const restaurantText = cafe.Restaurant
                ? cafe.Restaurant.toLowerCase()
                : "";
            const commentsText = cafe.comments
                ? cafe.comments.toLowerCase()
                : "";
            return restaurantText.includes(lowerKeyword) ||
                commentsText.includes(lowerKeyword);

        });
    }
    res.render('filter', { cafes: filteredCafes, rating, keyword });
});
// Starting the server
app.listen(3000, () => {
    console.log('Server started on port http://localhost:3000');
});