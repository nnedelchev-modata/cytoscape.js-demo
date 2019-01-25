var neo4j = require('neo4j-driver').v1;
var Movie = require('../../models/Movie');
var MovieCast = require('../../models/MovieCast');
var _ = require('lodash');

var driver = neo4j.driver("bolt://172.17.0.3:7687", neo4j.auth.basic("neo4j", "r0d0t123"));

function searchMovies(queryString) {
  var session = driver.session();
  return session
    .run(
      'MATCH (movie:Movie) \
      WHERE movie.title =~ {title} \
      RETURN movie',
      {title: '(?i).*' + queryString + '.*'}
    )
    .then(result => {
      session.close();
      return result.records.map(record => {
        return new Movie(record.get('movie'));
      });
    })
    .catch(error => {
      session.close();
      throw error;
    });
}

function getMovie(title) {
  var session = driver.session();
  return session
    .run(
      "MATCH (movie:Movie {title:{title}}) \
      OPTIONAL MATCH (movie)<-[r]-(person:Person) \
      RETURN movie.title AS title, \
      collect([person.name, \
           head(split(lower(type(r)), '_')), r.roles]) AS cast \
      LIMIT 1", {title})
    .then(result => {
      session.close();

      if (_.isEmpty(result.records))
        return null;

      var record = result.records[0];
      return new MovieCast(record.get('title'), record.get('cast'));
    })
    .catch(error => {
      session.close();
      throw error;
    });
}

exports.getMovie = getMovie;
exports.searchMovies = searchMovies;