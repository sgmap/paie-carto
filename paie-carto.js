"use strict";

$(document).ready(function () {
  $('#next1').click(function () {
    $("#maccueil").removeClass("active");
    $("#madresse").addClass("active");
    $('#page1').hide();
    $('#page2').fadeIn('slow');
  });

  $('#next2').click(function () {
    $("#madresse").removeClass("active");
    $("#simulateur").addClass("active");
    $('#page2').hide();
    $('#page3').fadeIn('slow');
    map.invalidateSize(false);
  });

  $('#next3').click(function () {
    $("#simulateur").removeClass("active");
    $("#resultat").addClass("active");
    $('#page3').hide();
    $('#page4').fadeIn('slow');
  });

  var engine = new Bloodhound({
    remote: {
      url: 'http://api-adresse.data.gouv.fr/search/?q=%QUERY',
      filter: function filter(list) {
        return $.map(list.features, function (adresse) {
          return {
            label: adresse.properties.label,
            geometry: adresse.geometry
          };
        });
      }
    },
    datumTokenizer: function datumTokenizer(datum) {
      return Bloodhound.tokenizers.whitespace(d);
    },
    queryTokenizer: Bloodhound.tokenizers.whitespace
  });

  engine.initialize();

  $('#adresse .typeahead').typeahead(null, {
    displayKey: 'label',
    source: engine.ttAdapter()
  }).on('typeahead:selected', function (event, data) {
    L.marker([data.geometry.coordinates[1], data.geometry.coordinates[0]]).addTo(map);
    map.setView(new L.LatLng(data.geometry.coordinates[1], data.geometry.coordinates[0]), 12);
    $.get("http://apicarto.coremaps.com/zoneville/api/beta/zfu", {
      x: data.geometry.coordinates[0],
      y: data.geometry.coordinates[1]
    }).done(function (data) {
      if (data.result) {
        var source = $("#zonage-template").html();
        var template = Handlebars.compile(source);
        var html = template(data);
        $('#information').html(html);
        $('#information').show();
      }
    });
  });

  var hash = function (s) {
    return s.split("").reduce(function (a, b) {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
  };

  var osm = new L.TileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
  });

  var stamen = new L.StamenTileLayer("toner");
  var map = new L.Map('map', {
    center: [50.691903, 3.165524],
    zoom: 10,
    layers: [stamen]
  });

  function style(feature) {
    return {
      fillColor: '#FC4E2A',
      weight: 1,
      opacity: 1,
      color: 'white',
      dashArray: '0',
      fillOpacity: 0.7
    };
  }
  var geojsonLayerZfu;
  var geojsonURL = 'http://apicarto.coremaps.com/tiles/communes/{z}/{x}/{y}.geojson';
  var geojsonTileLayer = new L.TileLayer.GeoJSON(geojsonURL, {
    clipTiles: true,
    unique: function unique(feature) {
      return feature.id;
    }
  }, {
    style: style,
    onEachFeature: onEachFeatureT
  });
  map.addLayer(geojsonTileLayer);

  var info = L.control({
    position: 'topright'
  });
  var hashurlopenfisca = {
    zfu: '',
    zrr: '',
    zrd: '',
    ber: ''
  };
  var sal = {};
  info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
    this.update();
    return this._div;
  };
  var zone = '';
  // method that we will use to update the control based on feature properties passed
  info.update = function (props) {
    if (typeof props !== 'undefined') {
      var targetUrl;
      var exec_request = false;
      props.title = '';
      if (typeof props.numzfu !== 'undefined') {
        props.title = 'ZFU - territoire entrepreneur';
        props.nom_comm = props.commune;
        props.exo = 'Vous bénéficiez d\'exonérations fiscales.';
        var zone = 'zfu';
        targetUrl = Embauche.OpenFisca.buildURL({
          zone_franche_urbaine: true
        });
        if (hashurlopenfisca.zfu != hash(targetUrl)) {
          exec_request = true;
          hashurlopenfisca.zfu = hash(targetUrl);
        }
      } else {
        props.exo = 'Vous bénéficiez d\'exonérations fiscales et sociales';
        if (props.ber == true) {
          props.title += ' BER ';
          var zone = 'ber';
          targetUrl = Embauche.OpenFisca.buildURL({
            bassin_emploi_redynamiser: true
          });
          if (hashurlopenfisca.ber != hash(targetUrl)) {
            exec_request = true;
            hashurlopenfisca.ber = hash(targetUrl);
          }
        }
        if (props.zrr == true) {
          props.title += ' ZRR ';
          var zone = 'zrr';
          targetUrl = Embauche.OpenFisca.buildURL({
            zone_revitalisation_rurale: true
          });
          if (hashurlopenfisca.zrr != hash(targetUrl)) {
            exec_request = true;
            hashurlopenfisca.zrr = hash(targetUrl);
          }
        }
        if (props.zrd == true) {
          props.title += ' ZRD ';
          var zone = 'zrd';
          targetUrl = Embauche.OpenFisca.buildURL({
            zone_restructuration_defense: true
          });
          if (hashurlopenfisca.zrd != hash(targetUrl)) {
            exec_request = true;
            hashurlopenfisca.zrd = hash(targetUrl);
          }
        }
      }
      var old_sal = parseFloat(window.Embauche.OpenFisca.getLastResults().salsuperbrut, 2);
      if (exec_request) {

        var request = new XMLHttpRequest();

        request.open('get', targetUrl);

        var data;
        request.onload = (function () {
          if (request.status != 200) throw request;

          data = JSON.parse(request.responseText);
          sal[zone] = data.values.salsuperbrut;
        }).bind(this);

        request.onerror = function () {
          throw request;
        };
        request.send();
      }

      var new_sal = sal[zone];

      props.salaire = new_sal.toFixed(2);
      props.cout = Math.round(new_sal / old_sal * 100);
      var source = $("#zonage-info").html();
      var template = Handlebars.compile(source);
      this._div.innerHTML = template(props);
    } else {
      $("select[name='zone_franche_urbaine'] option[value='false']").attr('selected', 'selected');
      $("select[name='bassin_emploi_redynamiser'] option[value='false']").attr('selected', 'selected');
      $("select[name='zone_revitalisation_rurale'] option[value='false']").attr('selected', 'selected');
      $("select[name='zone_restructuration_defense'] option[value='false']").attr('selected', 'selected');
      this._div.innerHTML = 'Survolez une zone pour connaitre la base d\'éxonération';
    }
  };

  info.addTo(map);

  function style() {
    return {
      fillColor: '#FC4E2A',
      weight: 1,
      opacity: 1,
      color: 'white',
      dashArray: '0',
      fillOpacity: 0.7
    };
  }

  $.ajax({
    url: 'http://apicarto.coremaps.com/zoneville/api/beta/zfu/mapservice',
    datatype: 'json',
    jsonCallback: 'getJson',
    success: loadGeoJson
  });

  function highlightFeature(e) {
    if (typeof e.layer == 'undefined') {
      var layer = e.target;
    } else {
      if (typeof e.layer.feature != 'undefined') var layer = e.layer;else {
        var layer = e.target;
      }
    }
    info.update(layer.feature.properties);

    layer.setStyle({
      weight: 5,
      color: '#666',
      dashArray: '',
      fillOpacity: 0.7
    });

    if (!L.Browser.ie && !L.Browser.opera) {
      layer.bringToFront();
    }
  }

  function BoundingBox() {
    var bounds = map.getBounds().getSouthWest().lng + "," + map.getBounds().getSouthWest().lat + "," + map.getBounds().getNorthEast().lng + "," + map.getBounds().getNorthEast().lat;
    return bounds;
  }

  function onEachFeature(feature, layer) {
    layer.on({
      mouseover: highlightFeature,
      mouseout: resetHighlight,
      click: zoomToFeature
    });
  }

  function onEachFeatureT(feature, layer) {
    layer.on({
      mouseover: highlightFeature,
      mouseout: resetHighlight,
      click: zoomToFeature
    });
  }

  function loadGeoJson(data) {
    geojsonLayerZfu = new L.GeoJSON(data, {
      style: style,
      onEachFeature: onEachFeature
    });
    map.addLayer(geojsonLayerWells);
  };

  function resetHighlight(e) {
    e.target.setStyle(style());
    window.debug = e.target;
    info.update();
  }

  function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
  }

  map.invalidateSize(false);

  map.on('moveend', function () {});
});
