var express = require('express');
var path = require('path');
var logger = require('morgan');
var neo4j = require('neo4j-driver').v1;
var neo4jApi = require('./public/js/neo4jApi');
var _ = require('lodash');

var bodyParser = require('body-parser');
var app = express();
var fs = require('fs');

var axios = require('axios');
var bcrypt = require('bcrypt-nodejs');
var session = require('express-session')
const LocalStrategy = require('passport-local').Strategy;
const uuid = require('uuid/v4')
const passport = require('passport');
const FileStore = require('session-file-store')(session);




// configure passport.js to use the local strategy
passport.use(new LocalStrategy(
    { usernameField: 'email' },
    (email, password, done) => {
      axios.get(`http://localhost:8000/users?email=${email}`)
      .then(res => {
        const user = res.data[0]
        if (!user) {
          return done(null, false, { message: 'Invalid credentials.\n' });
        }
        if (!bcrypt.compareSync(password, user.password)) {
          return done(null, false, { message: 'Invalid credentials.\n' });
        }
        return done(null, user);
      })
      .catch(error => done(error));
    }
  ));
  
  // tell passport how to serialize the user
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser((id, done) => {
    axios.get(`http://localhost:8000/users/${id}`)
    .then(res => done(null, res.data) )
    .catch(error => done(error, false))
  });
  



//View Engine 
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(session({
    genid: (req) => {
      return uuid() // use UUIDs for session IDs
    },
    store: new FileStore(),
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true
  }))

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(passport.initialize());
app.use(passport.session());

var driver = neo4j.driver('bolt://172.17.0.3:7687', neo4j.auth.basic('neo4j', 'r0d0t123'));
var neo4jSession = driver.session();


/*
[
    {
        "group": "nodes",
        "data": {
          "id": 0,
          "name": "The Matrix"
        }
      },
    
      {
        "group": "nodes",
        "data": {
          "id": 9,
          "name": "The Matrix Reloaded"
        }
      },
      ...
      {
        "data": {
          "id": 1149,
          "source": 46,
          "target": 49
        },
        "position": {},
        "group": "edges",
        "removed": false,
        "selected": false,
        "selectable": true,
        "locked": true,
        "grabbable": true,
        "classes": ""
        }
]
*/
/*

{ records: 
   [ Record {
       keys: [Array],
       length: 2,
       _fields: [Array],
       _fieldLookup: [Object] },
     Record {
       keys: [Array],
       length: 2,
       _fields: [Array],
       _fieldLookup: [Object] },

*/

function Record(keys, fields, keysLookup) {
    this.keys = keys,
    this.length = 2,
    this._fields = fields,
    this._fieldLookup = Object.assign({}, keysLookup)
}

Record.prototype.get = function(x) {
    var source = this.keys.indexOf(x);
    return this._fields[source];
};

let parseData = results => {
    var nodes = [], rels = [], i = 0, y = 500;
            var movie_id = 0;
            results.records.forEach(res => {
                var keys = res.keys;
                nodes.push({
                                "group": "nodes",
                                "data": {
                                    id: i, 
                                    name: res.get(keys[0]), 
                                    label: keys[0],
                                    type: 'diamond',
                                    classes: 'blue'
                                }
                            }
                );
                var target = i;
                
                i++;

                res.get('cast').forEach(name => {
                    var actor = {
                        "group": "nodes",
                        "data": {
                            name: name, 
                            label: keys[1]
                        }
                    };
                    
                    var source = _.findIndex(nodes, actor);
                    
                    if (source == -1) {
                        actor = {
                            "group": "nodes",
                            "data": {
                                id: i, 
                                name: name, 
                                label: keys[1], 
                                type: 'star'
                            }
                        };
                        if(i & 1){
                            actor = {
                                "group": "nodes",
                                "data": {
                                    id: i, 
                                    name: name, 
                                    label: keys[1], 
                                    parent: target, 
                                    type: 'star',
                                    classes: 'gold'
                                }
                            };
                        }
                        nodes.push(actor);
                        source = i;
                        i++;
                    }
                    rels.push({
                        "data": {
                            "id": 1000 + y,
                            "source": target,
                            "target": source,
                            "label": 'acted in'
                        },
                        "position": {},
                        "group": "edges",
                        "removed": false,
                        "selected": false,
                        "selectable": true,
                        "locked": true,
                        "grabbable": true,
                        "classes": "red"
                        })
                    y ++;
                })
                if(res.get('movie') !== ''){
                    movie_id++;
                }
            });

            return JSON.stringify(nodes.concat(rels));
}

app.post('/dataFromFe', function(req, res){
    var data = JSON.parse(req.body.data);
    var dataType = JSON.parse(req.body.type);
    var resultData = [];
    var fieldLookup = [];
        
    fieldLookup[dataType[0]] = 0;
    fieldLookup[dataType[1]] = 1;

    data.forEach(value => {
        var result = new Record(dataType, value.values, fieldLookup);
        resultData.push(
            result
        )
    })
    var output = parseData({
            records: resultData    
        });
    fs.writeFile('./public/datasets/custom.json', output, 'utf8', function(err) {
        if (err) throw err;
        console.log('complete');
        });
    res.send(JSON.stringify(output));
})

app.get('/api/getMovies', function(req, res){
    neo4jSession
        .run('MATCH (m:Movie)<-[:ACTED_IN]-(a:Person) \
        RETURN m.title AS movie, collect(a.name) AS cast \
        LIMIT {limit}', {limit: 50})
        .then(results => {
            neo4jSession.close();
            
            resultData = parseData(results);
            //console.log({nodes, links: rels});
            res.setHeader('Content-Type', 'application/json');
            //res.send(JSON.stringify(nodes.concat(rels)));
            res.send(resultData);
        })
        .catch(function(error){
            console.log(error);
        })

});

//User Login
app.post('/', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if(info) {return res.send(info.message)}
      if (err) { return next(err); }
      if (!user) { return res.redirect('/'); }
      req.login(user, (err) => {
        if (err) { return next(err); }
        return res.redirect('/');
      })
    })(req, res, next);
  })

app.get('/', function(req, res){
    if(req.isAuthenticated()) {
        return res.redirect('/demo');
    }else{
        res.render('index');
    }
})


//Render home
app.get('/demo', function(req, res){
    if(req.isAuthenticated()) {      
    //Get data from neo4j
    neo4jSession
        .run('MATCH (n) RETURN n LIMIT 50')
        .then(function(result){
            var movie_id, person_id = 0;
            var movieArr = [];
            var personArr = [];
            var personToMovieArr = [];
            result.records.forEach(function(record){
                if ((record._fields[0].labels)[0] === 'Movie'){
                    movie_id = record._fields[0].identity.low;
                    movieArr.push({
                        'id': record._fields[0].identity.low,
                        'name': record._fields[0].properties.title,
                        'tagline': record._fields[0].properties.tagline
                    })
                } else {
                    person_id = record._fields[0].identity.low;
                    personArr.push({
                        'id': record._fields[0].identity.low,
                        'name': record._fields[0].properties.name,
                        'yearBorn': record._fields[0].properties.born
                    })
                }
                personToMovieArr.push({
                    'movie_id': movie_id,
                    'person_id': person_id
                });
            });
            var searchTerm = req.query.search;
                
                if (typeof searchTerm !== 'undefined' ){
                    neo4jApi
                            .searchMovies(searchTerm)
                            .then(movies => {
                                console.log(movies);
                                /*
                                var t = $("table#results tbody").empty();
                          
                                if (movies) {
                                  movies.forEach(movie => {
                                    $("<tr><td class='movie'>" + movie.title + "</td><td>" + movie.released + "</td><td>" + movie.tagline + "</td></tr>").appendTo(t)
                                      .click(function() {
                                        showMovie($(this).find("td.movie").text());
                                      })
                                  });
                          
                                  var first = movies[0];
                                  if (first) {
                                    showMovie(first.title);
                                  }
                                }
                                */
                              }
                            )
                            .catch(function(error){
                                console.log(error);
                            })
                }
            res.render('demo', {
                movies: movieArr,
                persons: personArr,
                personToMovie: personToMovieArr
            });
        })
        .catch(function(error){
            console.log(error);
        })
    } else {
        res.redirect('/')
      }
});

app.listen(3000);
console.log("Server started at port 3000");

module.exports = app;