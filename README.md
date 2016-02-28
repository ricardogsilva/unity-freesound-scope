# unity-freesound-scope
A scope for ubuntu's unity8 that interacts with freesound.org

## General remarks on missing or incorrect functionality

There are some bugs in the javascript bindings that are currently
available on the phone on the stable channels, namely:

* Online accounts are totally broken (seems this was fixed already but not
  published yet) and therefore we are not shipping manifest files for
  enabling them nor using them in the scope. See https://bugs.launchpad.net/unity-js-scopes/+bug/1549477

* PreviewWidgets whose `add_attribute_value()` method is supposed to accept
  an array of objects do not work as documented. Instead they only accept
  a single object, thus negating the possibility of adding multiple entries.
  This is the case for PreviewWidget of types:

  * audio,
  * actions,
  * table,

  See for example https://bugs.launchpad.net/unity-js-scopes/+bug/1541720

* PreviewWidgets of type _review_ do not show up at all in the phone, while
  they work just fine on the desktop

Unfortunately the resolution of these issues is beyond me. As such, I chose to 
provide a simpler experience for this scope, in order to have at least a working
application and make users happy.

Once the mentioned issues get fixed and are published to the stable channel I'll be 
happy to improve the scope with more bells and whistles ;)

Happy freesounding!
