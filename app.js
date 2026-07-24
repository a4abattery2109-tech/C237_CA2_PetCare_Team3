const express = require('express');
const mysql = require('mysql2');
// use this for the team github thing
const path = require("path");
const multer = require('multer');
//******** TODO: Insert code to import 'express-session' *********//
const session = require('express-session');

const flash = require('connect-flash');

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public', 'images'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const app = express();

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
app.use("/images", express.static(path.join(__dirname, 'public', 'images')));

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
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/animal');
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

app.get('/animal', checkAuthenticated, (req, res) => {
    const sql = 'SELECT animalId, animalName, species, `condition`, image, history FROM animal';
    connection.query(sql, (error, results) => {
        if (error) throw error;
        res.render('animal', { animal: results, user: req.session.user });
    });
});

app.get('/animalAdmin', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = 'SELECT animalId, animalName, species, `condition`, image, history FROM animal';
    connection.query(sql, (error, results) => {
        if (error) throw error;
        res.render('animalAdmin', { animal: results, user: req.session.user });
    });
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
            if (results[0].role === 'admin') {
                res.redirect('/animalAdmin');
            } else {
                res.redirect('/animal');
            }
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

//******** TODO: Insert code for logout route ********//
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Define a route to view animal details
app.get('/animal/:id', checkAuthenticated, (req, res) => {
    // Extract the animal ID from the request parameters
    const animalId = req.params.id;

    // Fetch data from MySQL based on the animal ID
    const sql = 'SELECT animalId, animalName, species, `condition`, image, history FROM animal WHERE animalId = ?';
    connection.query(sql, [animalId], (error, results) => {
        if (error) throw error;

        // Check if any animal with the given ID was found
        if (results.length > 0) {
            // Render HTML page with the animal data
            res.render('viewAnimal', { animal: results[0], user: req.session.user });
        } else {
            // If no animal with the given ID was found, render a 404 page or handle it accordingly
            res.status(404).send('Animal not found');
        }
    });
});

// //******** TODO: Insert code for adding an animal ********//
app.get('/addAnimal', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addAnimal', { user: req.session.user });
});

app.post('/addAnimal', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
    // Extract animal data from the request body
    const { animalName, species, condition, history } = req.body;
    let image;
    if (req.file) {
        image = req.file.filename; // Save only the filename
    } else {
        image = null;
    }

    const sql = 'INSERT INTO animal (animalName, species, `condition`, image, history) VALUES (?, ?, ?, ?, ?)';
    // Insert the new animal into the database
    connection.query(sql, [animalName, species, condition, image, history], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error adding animal:", error);
            res.status(500).send('Error adding animal');
        } else {
            // Send a success response
            req.flash('success', 'Animal added successfully!');
            res.redirect('/animal');
        }
    });
});

// Define a route to render the appointments page
app.get('/addAppointment', checkAuthenticated, (req, res) => {
    res.render('addAppointments', { user: req.session.user });
});

app.post('/addAppointment', checkAuthenticated, (req, res) => {
    // Placeholder submit route so the form posts cleanly until DB logic is added.
    req.flash('success', 'Appointment form submitted.');
    res.redirect('/addAppointment');
});

//Define a route to render the contact us page
app.get('/contact', (req, res) => {
    res.render('contact', { user: req.session.user });
});

app.post('/contact', (req, res) => {
    const { name, email, contact, comments } = req.body;
    res.render('confirm', { name, email, contact, comments });
});

// define a route to render filtering
app.get('/filter', (req, res) => {
    const keyword = req.query.keyword;
    let sql = 'SELECT * FROM animal';
    let params = [];

    if (keyword) {
        sql += ' WHERE animalName LIKE ? OR `condition` LIKE ? OR history LIKE ?';
        const searchKeyword = `%${keyword}%`;
        params.push(searchKeyword, searchKeyword, searchKeyword);
    }

    connection.query(sql, params, (error, results) => {
        if (error) {
            console.error("Error filtering animals:", error);
            res.status(500).send("Error occurred while filtering animals");
        } else {
            res.render('filter', { animals: results, keyword: keyword, user: req.session.user });
        }
    });
});

// Define a route to render the update animal page
app.get('/updateAnimal/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const animalId = req.params.id;
    const sql = 'SELECT animalId, animalName, species, `condition`, image, history FROM animal WHERE animalId = ?';

    // Fetch data from MySQL based on the animal ID
    connection.query(sql, [animalId], (error, results) => {
        if (error) throw error;

        // Check if any animal with the given ID was found
        if (results.length > 0) {
            // Render HTML page with the animal data
            res.render('updateAnimal', { animal: results[0], user: req.session.user });
        } else {
            // If no animal with the given ID was found, render a 404 page or handle it accordingly
            res.status(404).send('Animal not found');
        }
    });
});

app.post('/updateAnimal/:id', checkAuthenticated, checkAdmin, upload.single('image'), (req, res) => {
    const animalId = req.params.id;
    // Extract animal data from the request body
    const { animalName, species, condition, history } = req.body;
    let image = req.body.currentImage; //retrieve current image filename
    if (req.file) { //if new image is uploaded
        image = req.file.filename; // set image to be new image filename
    }

    const sql = 'UPDATE animal SET animalName = ? , species = ?, `condition` = ?, history = ?, image = ? WHERE animalId = ?';
    // Insert the new animal into the database
    connection.query(sql, [animalName, species, condition, history, image, animalId], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error updating animal:", error);
            res.status(500).send('Error updating animal');
        } else {
            // Send a success response
            res.redirect('/animalAdmin');
        }
    });
});

// Define a route to delete an Animal
app.get('/deleteAnimal/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const animalId = req.params.id;

    connection.query('DELETE FROM animal WHERE animalId = ?', [animalId], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error deleting animal:", error);
            res.status(500).send('Error deleting animal');
        } else {
            // Send a success response
            res.redirect('/animalAdmin');
        }
    });
});

// Starting the server
app.listen(3000, () => {
    console.log('Server started on port http://localhost:3000');
});