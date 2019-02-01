var express = require('express');
var path = require('path');
var logger = require('morgan');
var neo4j = require('neo4j-driver').v1;
var neo4jApi = require('./public/js/neo4jApi');
var _ = require('lodash');

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

app.get('/api/getMovies', function(req, res){
    session
        .run('MATCH (m:Movie)<-[:ACTED_IN]-(a:Person) \
        RETURN m.title AS movie, collect(a.name) AS cast \
        LIMIT {limit}', {limit: 50})
        .then(results => {
            session.close();
            var nodes = [], rels = [], i = 0, y = 500;
            var movie_id = 0;
            results.records.forEach(res => {
                nodes.push({
                                "group": "nodes",
                                "data": {
                                    id: i, 
                                    name: res.get('movie'), 
                                    label: 'movie',
                                    type: 'diamond'
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
                            label: 'actor'
                        }
                    };
                    
                    var source = _.findIndex(nodes, actor);
                    
                    if (source == -1) {
                        actor = {
                            "group": "nodes",
                            "data": {
                                id: i, 
                                name: name, 
                                label: 'actor', 
                                type: 'star'
                            }
                        };
                        if(i & 1){
                            actor = {
                                "group": "nodes",
                                "data": {
                                    id: i, 
                                    name: name, 
                                    label: 'actor', 
                                    parent: target, 
                                    type: 'star'
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
            //console.log({nodes, links: rels});
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(nodes.concat(rels)));
        })
        .catch(function(error){
            console.log(error);
        })

});

//Render home
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