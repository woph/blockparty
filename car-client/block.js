

var blockApp = angular.module('BlockApp', [], function() {});

blockApp.controller('BlockController', function($scope, $http, Base64, $interval, $filter, $timeout) {

  $scope.lastProcessedBlocktime = 0;

  $scope.vin = {
    list: [
      'WP023948782357890',
      'WP023948782357891',
      'WP023948782357892',
      'WP023948782357893',
      'WP023948782357894',
      'WP023948782357895',
      'WP023948782357896',
      'WP023948782357897'
    ],
    grabOne: function() {
      return this.list[_.random(0,this.list.length-1)];
    }
  };


  String.prototype.hexEncode = function(){
    var hex, i;
    var result = "";
    for (i=0; i<this.length; i++) {
        hex = this.charCodeAt(i).toString(16);
        result += ("0"+hex).slice(-2);
    }
    return result;
  };

  function getTransactions() {
    $scope.transactions = [];
    var assets = ['eon_kwh','ENBW_kwh'];
    _.each(assets, function(assetname) {
      $http.post($scope.url, {
        method: 'listassettransactions',
        params: [assetname]
      }).then(function(success) {
        //alert(JSON.stringify(success));
        _.each(success.data.result, function(transaction) {
          if(_.contains(_.keys(transaction.addresses), $scope.address)) {
            if(transaction.blocktime > $scope.lastProcessedBlocktime) {
              transaction.pushedToStream = false;
            } else {
              transaction.pushedToStream = true;
            }
            $scope.transactions.push(transaction);
          }
        });
        // sort by blocktime:
        $scope.transactions = $filter('orderBy')($scope.transactions, 'blocktime', false);
        // wait 4 seconds for user feedbacK
        // now we have all transactions where this wallet is affected AND which is new
        _.each($scope.transactions, function(transaction) {
          var randomVin = $scope.vin.grabOne();
          // get details from a transaction with the getrawtransaction method
          $http.post($scope.url, {
            method: 'getrawtransaction',
            params: [transaction.txid, 1]
          }).then(function(rawtransaction) {
            rawtransaction = rawtransaction.data.result;
            var tx = _.find(rawtransaction.vout, function(transaction) {
              return transaction.scriptPubKey.addresses[0] === $scope.address;
            });
            if(tx != null && tx != undefined) {
              var asset = tx.assets[0];
              transaction.entity = asset.name;
              if(transaction.pushedToStream === false) {
                $timeout(function() {
                  var streamItem = {
                    vin: randomVin,
                    provider: asset.name.indexOf('_') === -1 ? asset.name.toLowerCase() : asset.name.substr(0, asset.name.indexOf('_')).toLowerCase(),
                    chargeUnit: asset.name,
                    chargeAmount: asset.raw,
                    price: 0.19
                  };
                  var payload = JSON.stringify(streamItem).hexEncode();
                  // publish an item to the stream:
                  $http.post($scope.url, {
                    method: 'publish',
                    params: ['ladeVorgaenge', randomVin, payload]
                  }).then(function(success) {
                    transaction.pushedToStream = true;
                    if($scope.lastProcessedBlocktime < transaction.blocktime) {
                      var d = new Date(0);
                      d.setUTCSeconds(transaction.blocktime);
                      var day = d.getDate();
                      var monthIndex = d.getMonth();
                      var year = d.getFullYear();
                      var hh = d.getUTCHours();
                      var mm = d.getUTCMinutes();
                      var ss = d.getSeconds();
                      $scope.lastProcessedBlocktime = day + '.' + (monthIndex+1) + '.' + year + ' ' + hh + ':' + mm + ':' + ss;
                      $scope.lastProcessedBlocktime = transaction.blocktime;
                    }
                  }, function(error) {
                  });
                }, 1000);
              }
            }
          }, function(error) {
            console.log(error);
          });
        });
      },function(error) {
        console.log(error);
      });
    });
  };

  $scope.credentials = {
    address: '127.0.0.1',
    port: '4326',
    username: 'multichainrpc',
    password: 'EQx6hhzzTkuuV1orAd5GhwZBc77jTJcuqqbbCg8uBTat',
    valid: false,
    connect: function() {
      $scope.url = 'http://' + $scope.credentials.address + ':' + $scope.credentials.port;
      var authdata = Base64.encode($scope.credentials.username + ':' + $scope.credentials.password);
      $http.defaults.headers.common['Authorization'] = 'Basic ' + authdata;
      $http.defaults.headers.common['ContentType'] = 'application/json-rpc';
      var http = $http.post($scope.url, {
        method: 'getinfo',
        params: []
      });
      http.then(function(successResponse) {
  			$scope.credentials.valid = true;
        $scope.api.info = successResponse;

        $scope.transactions = [];
        $scope.address = '';

        // first of all, grab the wallet address:
        $http.post($scope.url, {
          method: 'getaddresses',
          params: []
        }).then(function(success) {
          if(success.data.result.length > 0) $scope.address = success.data.result[0];
          getTransactions();
          $interval(function() {
            getTransactions();
            var http = $http.post($scope.url, {
              method: 'getinfo',
              params: []
            });
            http.then(function(successResponse) {
              $scope.api.info = successResponse;
            }, function(error) {
              console.log(error);
            });
          }, 15000);
        },function(error) {
          console.log(error);
        });

  		}, function(errorResponse) {
  			alert('ERROR: ' + JSON.stringify(errorResponse));
  		});
    }
  };

  $scope.api = {};

});

blockApp.factory('Base64', function () {
    /* jshint ignore:start */

    var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

    return {
        encode: function (input) {
            var output = "";
            var chr1, chr2, chr3 = "";
            var enc1, enc2, enc3, enc4 = "";
            var i = 0;

            do {
                chr1 = input.charCodeAt(i++);
                chr2 = input.charCodeAt(i++);
                chr3 = input.charCodeAt(i++);

                enc1 = chr1 >> 2;
                enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
                enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
                enc4 = chr3 & 63;

                if (isNaN(chr2)) {
                    enc3 = enc4 = 64;
                } else if (isNaN(chr3)) {
                    enc4 = 64;
                }

                output = output +
                    keyStr.charAt(enc1) +
                    keyStr.charAt(enc2) +
                    keyStr.charAt(enc3) +
                    keyStr.charAt(enc4);
                chr1 = chr2 = chr3 = "";
                enc1 = enc2 = enc3 = enc4 = "";
            } while (i < input.length);

            return output;
        },

        decode: function (input) {
            var output = "";
            var chr1, chr2, chr3 = "";
            var enc1, enc2, enc3, enc4 = "";
            var i = 0;

            // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
            var base64test = /[^A-Za-z0-9\+\/\=]/g;
            if (base64test.exec(input)) {
                window.alert("There were invalid base64 characters in the input text.\n" +
                    "Valid base64 characters are A-Z, a-z, 0-9, '+', '/',and '='\n" +
                    "Expect errors in decoding.");
            }
            input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

            do {
                enc1 = keyStr.indexOf(input.charAt(i++));
                enc2 = keyStr.indexOf(input.charAt(i++));
                enc3 = keyStr.indexOf(input.charAt(i++));
                enc4 = keyStr.indexOf(input.charAt(i++));

                chr1 = (enc1 << 2) | (enc2 >> 4);
                chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
                chr3 = ((enc3 & 3) << 6) | enc4;

                output = output + String.fromCharCode(chr1);

                if (enc3 != 64) {
                    output = output + String.fromCharCode(chr2);
                }
                if (enc4 != 64) {
                    output = output + String.fromCharCode(chr3);
                }

                chr1 = chr2 = chr3 = "";
                enc1 = enc2 = enc3 = enc4 = "";

            } while (i < input.length);

            return output;
        }
    };

    /* jshint ignore:end */
});
