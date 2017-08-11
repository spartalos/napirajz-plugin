/* Social Network Share */
var randomButtonTexts = ['STÉG', 'ZAPPA', 'STUNK', 'KONGLON', 'HRANULÁK', 'TADÜN',
'GLÓTAH', 'SKALÜNT', 'KREDALÁN', 'AMAKUN', 'KANDÁN', 'FLOCSK', 'FLASK', 'VROMPLON', 'VEGANÉZ'
, 'UDUN', 'FLOKSZON', 'SZLOPAKIKKI', 'ROMMEL', 'RÖTÖPEM'];

var mailToUrl = 'mailto:?subject=Napirajz&body=';
var mailToIconUrl = './mailto-logo.png';

var faceShareUrl = 'https://www.facebook.com/sharer/sharer.php?u=';
var faceIconUrl = './fb-logo.png';

var tumbrlShareUrl = 'http://tumblr.com/widgets/share/tool?canonicalUrl=';
var tumblrIconUrl = './tumblr-logo.png';

var twitterShareUrl = 'https://twitter.com/intent/tweet?text=';
var twitterIconUrl = './twitter-logo.png';

function httpGet(url, callback){
  var xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function(){
    if(xmlHttp.readyState == 4 && xmlHttp.status == 200){
      callback(xmlHttp.responseText);
    }
  }
  xmlHttp.open("GET", url, true);
  xmlHttp.send(null);
}

function createImageElement(imageUrl){
  var imgTag=document.createElement("img");
      imgTag.setAttribute('src', imageUrl);
      imgTag.setAttribute('alt', 'na');
      imgTag.setAttribute('style', 'max-width: 100%;');
  return imgTag;
}

function createAElement(href, imgTag){
  var aTag = document.createElement("a");
  aTag.setAttribute('href', href);
  aTag.appendChild(imgTag);
  return aTag;
}

function addToShareContainer(){
  var shareContainer = document.getElementById('shareContainer');
  shareContainer.innerHTML = '';
  var i;
  for (i = 0; i < arguments.length; i++) {
    shareContainer.appendChild(arguments[i]);
  }
}

function createShare(shareBaseUrl, iconUrl, href){
  var shareTag = document.createElement("a");
  shareTag.setAttribute('href', shareBaseUrl + href);
  shareTag.setAttribute('target', '_blank');
  shareTag.setAttribute('style', 'margin: 10px;')
  var icon = document.createElement("img");
  icon.setAttribute('src', iconUrl);
  shareTag.appendChild(icon);
  return shareTag;
}

function createH2(text){
  var h2 = document.createElement('h2');
  h2.innerHTML = text;
  return h2;
}

function createRajz(parsedResponse){
  var rajz = getFirst(parsedResponse);
  var rajzUrl = encodeURIComponent(rajz.LapURL != '' ? rajz.LapURL : rajz.URL);
  document.getElementById('kepdiv').innerHTML = '';
  document.getElementById('kepdiv').appendChild(createAElement(rajz.LapURL != '' ? rajz.LapURL : rajz.URL, createImageElement(rajz.URL)));
  document.getElementById('cimDiv').innerHTML = '';
  document.getElementById('cimDiv').appendChild(createH2(rajz.Cim));
  addToShareContainer(
              createShare(mailToUrl, mailToIconUrl, rajzUrl),
              createShare(faceShareUrl, faceIconUrl, rajzUrl),
              createShare(tumbrlShareUrl, tumblrIconUrl, rajzUrl),
              createShare(twitterShareUrl, twitterIconUrl, rajzUrl)
              );
}

function getFormattedDate(){
  var today = new Date();
  return today.getFullYear() + '-' + today.getMonth()+1 + '-' + today.getDate();
}

function getRandom(){
  httpGet('http://kereso.napirajz.hu/abort.php?guppi&json',
          function(responseRand){
            createRajz(JSON.parse(responseRand));
          });
}

function getFirst(responseJson){
  for(pic in responseJson){
    return responseJson[pic];
  }
}

function setButtonText(button){
  button.innerHTML = randomButtonTexts[Math.floor(Math.random()*randomButtonTexts.length)];
}

window.onload = function(){
  var randomButton = document.getElementById('randomDiv');
  randomButton.onclick = function(){
    getRandom();
    setButtonText(this);
  }
  setButtonText(randomButton);
  getRandom();
}
