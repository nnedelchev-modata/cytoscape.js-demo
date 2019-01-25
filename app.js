var express = require('express');
var path = require('path');
var logger = require('morgan');
var neo4j = require('neo4j-driver').v1;

var bodyParser = require('body-parser');
var app = express();

//View Engine 
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

var driver = neo4j.driver('bolt://172.17.0.3:7687', neo4j.auth.basic('neo4j', 'r0d0t123'));
var session = driver.session();

app.get('/', function(req, res){
    //Get data from neo4j
    session
        .run('MATCH (n) RETURN n LIMIT 50')
        .then(function(result){
            var movie_id, person_id = 0;
            var movieArr = [];
            var personArr = [];
            var personToMovieArr = [];
            result.records.forEach(function(record){
                console.log(record._fields[0].labels);
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
                })
                //console.log(movie_id+' '+ person_id);
            });
            //console.log(movieArr);

            res.render('index', {
                movies: movieArr,
                persons: personArr,
                personToMovie: personToMovieArr
            });
        })
        .catch(function(error){
            console.log(error);
        })
});

app.listen(3000);
console.log("Server started at port 3000");

module.exports = app;