(function(){
  document.addEventListener('DOMContentLoaded', function(){
    let $$ = selector => Array.from( document.querySelectorAll( selector ) );
    let $ = selector => document.querySelector( selector );

    let tryPromise = fn => Promise.resolve().then( fn );

    let toJson = obj => obj.json();
    let toText = obj => obj.text();

    

    let cy;

    let $stylesheet = $('#style');
    let $nodeInfo = $('.nodeInfo');
    let getStylesheet = name => {
      let convert = res => name.match(/[.]json$/) ? toJson(res) : toText(res);

      return fetch(`stylesheets/${name}`).then( convert );
    };
    let applyStylesheet = stylesheet => {
      if( typeof stylesheet === typeof '' ){
        cy.style().fromString( stylesheet ).update();
      } else {
        cy.style().fromJson( stylesheet ).update();
      }
    };
    //Show Hide right menu
    $('#config-toggle').addEventListener('click', function(){
      $('body').classList.toggle('config-closed');
      cy.resize();
    });

    $('#connect-toggle').addEventListener('click', function(){
      $('body').classList.toggle('connect-closed');
      cy.resize();
    });

    let applyStylesheetFromSelect = () => Promise.resolve( $stylesheet.value ).then( getStylesheet ).then( applyStylesheet );

    let $dataset = $('#data');

    let $resultTable = $('#result');
    let getDataset = name => {
      if(name === 'moviesNeo'){
        return fetch('api/getMovies').then( toJson );
      } else {
        return fetch(`datasets/${name}`).then( toJson );
      }
    }
    let nodeValue = (container, id, nodeLabel, labels, properties) => {
      var card = document.createElement("div"),
          cardHeader = document.createElement("h5"),
          cardBody = document.createElement("div"),
          div = document.createElement("div");
      
      card.setAttribute("class", "card");
      cardHeader.setAttribute("class", "card-header");
      cardHeader.appendChild(document.createTextNode("#" + id + " " + labels + "("+nodeLabel+")"));
      cardBody.setAttribute("class", "card-body");
      
      var content = "<h5>Relations: </h5>";
      for(i=0 ; i < properties.length; i++){
        content += "<strong>"+properties[i].name+"</strong> ("+properties[i].label+")<br />";
        //console.log(properties[i].name);
      }
      //cardBody.appendChild(document.createTextNode(JSON.stringify(properties)));
      cardBody.innerHTML = content;
      card.appendChild(cardHeader);
      card.appendChild(cardBody);
      return card;
  }

    let applyDataset = dataset => {
      // so new eles are offscreen
      cy.zoom(0.001);
      cy.pan({ x: -9999999, y: -9999999 });

      // replace eles
      cy.elements().remove();
      cy.add( dataset );

      //Get Clicked Node
      cy.on('click', 'node', function (event) {
        cy.elements().removeClass('highlighted');
        console.log(cy.elements().jsons());
        var nodeId = event.cyTarget._private.data.id;
        var nodeName = event.cyTarget._private.data.name;
        var nodeLabel = event.cyTarget._private.data.label;
        var connectedEdges = event.cyTarget._private.edges
        var i = 0;

        var connectedData = [];
        let highlightNextEle = () => {
            if( i < connectedEdges.length ){
                //console.log(connectedEdges[i]);
                if(nodeLabel === 'cast'){                  
                  connectedData.push({
                    name : connectedEdges[i]._private.source._private.data.name,
                    label: connectedEdges[i]._private.source._private.data.label
                  })
                } else {
                  connectedData.push({
                    name : connectedEdges[i]._private.target._private.data.name,
                    label: connectedEdges[i]._private.target._private.data.label
                  })
                }
                
                connectedEdges[i].addClass('highlighted');
                i++;
                
                highlightNextEle();
            }
        };
        highlightNextEle();

        var div = $(".nodeInfo");
        div.innerHTML = "";
        var content = nodeValue('body', nodeId,  nodeLabel, nodeName, connectedData);
        div.appendChild(content);
      });
    }
    let applyDatasetFromSelect = () => Promise.resolve( $dataset.value ).then( getDataset ).then( applyDataset );

    let applyDatasetFromBrowser = () => Promise.resolve( 'custom.json' ).then( getDataset ).then( applyDataset );

    let calculateCachedCentrality = () => {
      let nodes = cy.nodes();

      if( nodes.length > 0 && nodes[0].data('centrality') == null ){
        let centrality = cy.elements().closenessCentralityNormalized();

        nodes.forEach( n => n.data( 'centrality', centrality.closeness(n) ) );
      }
    };

    

    let $layout = $('#layout');
    let maxLayoutDuration = 20;
    let layoutPadding = 20;
    let concentric = function( node ){
      calculateCachedCentrality();

      return node.data('centrality');
    };
    let levelWidth = function( nodes ){
      calculateCachedCentrality();

      let min = nodes.min( n => n.data('centrality') ).value;
      let max = nodes.max( n => n.data('centrality') ).value;


      return ( max - min ) / 5;
    };
    let layouts = {
      cola: {
        name: 'cola',
        padding: layoutPadding,
        nodeSpacing: 12,
        edgeLengthVal: 45,
        animate: true,
        randomize: true,
        maxSimulationTime: maxLayoutDuration,
        flow: { axis: 'y', minSeparation: 30 },
        avoidOverlap: true,
        fit: true,
        //infinite: true,
        levelWidth: levelWidth,
        boundingBox: {
          x1: 0,
          y1: 0,
          x2: 600,
          y2: 600
        },
        //edgeLength: function( e ){
        //  let w = e.data('weight');

        //  if( w == null ){
        //    w = 0.5;
        //  }

        //  return 45 / w;
        //}
      },
      concentricCentrality: {
        name: 'concentric',
        padding: layoutPadding,
        animate: true,
        animationDuration: maxLayoutDuration,
        concentric: concentric,
        levelWidth: levelWidth
      },
      concentricHierarchyCentrality: {
        name: 'concentric',
        padding: layoutPadding,
        animate: true,
        animationDuration: maxLayoutDuration,
        concentric: concentric,
        levelWidth: levelWidth,
        sweep: Math.PI * 2 / 3,
        clockwise: true,
        startAngle: Math.PI * 1 / 6
      },
      custom: {
        name: 'preset',
        padding: layoutPadding
      }
    };
    let prevLayout;
    let getLayout = name => Promise.resolve( layouts[ name ] );
    let applyLayout = layout => {
      if( prevLayout ){
        prevLayout.stop();
      }

      let l = prevLayout = cy.makeLayout( layout );

      return l.run().promiseOn('layoutstop');
    }
    let applyLayoutFromSelect = () => Promise.resolve( $layout.value ).then( getLayout ).then( applyLayout );

    let $algorithm = $('#algorithm');
    let getAlgorithm = (name) => {
      switch (name) {
        case 'bfs': return Promise.resolve(cy.elements().bfs.bind(cy.elements()));
        case 'dfs': return Promise.resolve(cy.elements().dfs.bind(cy.elements()));
        case 'astar': return Promise.resolve(cy.elements().aStar.bind(cy.elements()));
        case 'none': return Promise.resolve(undefined);
        case 'custom': return Promise.resolve(undefined); // replace with algorithm of choice
        default: return Promise.resolve(undefined);
      }
    };
    let runAlgorithm = (algorithm) => {
      if (algorithm === undefined) {
        return Promise.resolve(undefined);
      } else {
        let options = {
          root: '#' + cy.nodes()[0].id(),
          // astar requires target; goal property is ignored for other algorithms
          goal: '#' + cy.nodes()[Math.round(Math.random() * (cy.nodes().size() - 1))].id()
        };
        return Promise.resolve(algorithm(options));
      }
    }
    let currentAlgorithm;
    let animateAlgorithm = (algResults) => {
      // clear old algorithm results
      cy.$().removeClass('highlighted start end');
      currentAlgorithm = algResults;
      if (algResults === undefined || algResults.path === undefined) {
        return Promise.resolve();
      }
      else {
        let i = 0;
        // for astar, highlight first and final before showing path
        if (algResults.distance) {
          // Among DFS, BFS, A*, only A* will have the distance property defined
          algResults.path.first().addClass('highlighted start');
          algResults.path.last().addClass('highlighted end');
          // i is not advanced to 1, so start node is effectively highlighted twice.
          // this is intentional; creates a short pause between highlighting ends and highlighting the path
        }
        return new Promise(resolve => {
          let highlightNext = () => {
            if (currentAlgorithm === algResults && i < algResults.path.length) {
              algResults.path[i].addClass('highlighted');
              i++;
              setTimeout(highlightNext, 500);
            } else {
              // resolve when finished or when a new algorithm has started visualization
              resolve();
            }
          }
          highlightNext();
        });
      }
    };
    let applyAlgorithmFromSelect = () => Promise.resolve( $algorithm.value ).then( getAlgorithm ).then( runAlgorithm ).then( animateAlgorithm );

    cy = window.cy = cytoscape({
      container: $('#cy')
    });

    tryPromise( applyDatasetFromSelect ).then( applyStylesheetFromSelect ).then( applyLayoutFromSelect );

    $dataset.addEventListener('change', function(){
      tryPromise( applyDatasetFromSelect ).then( applyLayoutFromSelect ).then ( applyAlgorithmFromSelect );
    });

    $resultTable.addEventListener('change', function(){
      console.log("Changed");
    })

    $stylesheet.addEventListener('change', applyStylesheetFromSelect);

    $layout.addEventListener('change', applyLayoutFromSelect);

    $('#redo-layout').addEventListener('click', applyLayoutFromSelect);

    $algorithm.addEventListener('change', applyAlgorithmFromSelect);

    $('#redo-algorithm').addEventListener('click', applyAlgorithmFromSelect);

    $("#run-button").addEventListener("click", function() {
      tryPromise( applyDatasetFromBrowser ).then( applyLayoutFromSelect ).then ( applyAlgorithmFromSelect );
  });

  });
})();

// tooltips with jQuery
$(document).ready(() => {
  $('.tooltip').tooltipster();
});