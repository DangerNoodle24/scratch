const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../models/socialModels');
const saltRounds = 10;
const jwtSecret = 'super-secret-secret';

const authController = {};

// const db = {
//   username: 'angelo',
//   password: '$2b$10$MNntgeRRJo02PJUQDWMS8O7q5YhwZjYy0VZL0TpR9wPcWWUg3jio2',
// };

authController.create = (req, res, next) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return next({
      log: 'Error in authController.create',
      status: 401,
      message: 'Missing username or password in request body',
    });
  }

  bcrypt.hash(password, saltRounds).then((hash) => {
    
    const query = `
        INSERT INTO users(username, password)
        VALUES ($1, $2)
        RETURNING username, _id`;

    //SAVE TO DB
    db.query(query, [username, hash]).then((data) => {
      // console.log('log from inside authController.create: ', data.rows[0]);
      // GET USER ENTRY BACK FROM DB, store in res.locals
      const user = {
        username: data.rows[0].username,
        id: data.rows[0]._id,
      }

      res.locals.user = user;

      return next();
    });
  });
};

authController.login = (req, res, next) => {
  const { username, password } = req.body;

  // READ USER FROM DB
  const query = `
    SELECT username, password, _id, votes FROM users
    WHERE username = $1`;

  db.query(query, [username])
    .then((data) => {
      //check if user is in DB
      // console.log('data.rows=====================================', data.rows)
      if (data.rows.length === 0) return res.redirect('/')
      // Compare plaintext pass to hash from DB
      bcrypt.compare(password, data.rows[0].password).then((result) => {

        if (!result) return res.redirect('/')
        if (result) {
          const user = {
            username: data.rows[0].username,
            id: data.rows[0]._id,
            //
            votes: data.rows[0].votes
          };

          res.locals.user = user;
          return next();
        }

        return next({
          log: 'error authController.login',
          status: 401,
          message: 'invalid username/password combination',
        });
      });
    })
    .catch((error) => {
      console.log(error);
      return next(error);
    });
};

authController.verifyUser = (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) {
    return res.json();
  }

  // Verify Token
  jwt.verify(token, jwtSecret, (err, decoded) => {
    if (!decoded) return res.json();
    const { username, id, votes} = decoded;
    res.locals.user = { username, id, votes};

    return next();
  });
};
authController.getUserData = (req, res, next) => {
  const {username, id} = res.locals.user;

  const query = {
    text: 'SELECT * FROM users WHERE _id = $1',
    values: [id]
  }

  db.query(query)
    .then(data => {
      const {_id, username, votes} = data.rows[0];
      res.locals.user = {
        id: _id,
        username: username,
        votes: votes
      }
      return next()
    })
    .catch(err=> {
      return next({
        message: 'Error getting user info in getUserData middleware in authController',
        error: err
      })
    })
}

authController.addJWT = (req, res, next) => {
  const { username } = req.body;
  const { id, votes } = res.locals.user;
  jwt.sign(
    { username, id, votes },
    jwtSecret,
    {
      expiresIn: '1h',
    },
    (err, token) => {
      if (err) {
        return res.status(400).json('error creating jwt');
      }
      // Store jwt in res.cookies
      res.cookie('jwt', token, { httpOnly: true });
      return next();
    }
  );
};

authController.logout = (req, res, next) => {
  res.cookie('jwt', null);
  return next();
};

// /auth/check - GET request to see if user is logged in

module.exports = authController;
