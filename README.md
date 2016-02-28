# unity-freesound-scope
A scope for ubuntu's unity8 that interacts with freesound.org

## GENERAL REMARKS ON MISSING OR INCORRECT FUNCTIONALITY:

There are some bugs in the javascript bindings that are currently
available on the phone on the stable channels, namely:

* Online accounts are totally broken (seems this was fixed already but not
  published yet) and therefore we are not shipping manifest files for
  enabling them nor instnatiating them here

* PreviewWidgets whose `add_attribute_value()` method is supposed to accept
  an array of objects do not work as documented. Instead they only accept
  a single object, thus negating the possibility of adding multiple entries.
  This is the case for PreviewWidget of types:

  * audio,
  * actions,
  * table,

* PreviewWidgets of type _expandable_ do not work if they contain more than
  one widget, which defeats the whole purpose of them being expandable in
  the first place

* PreviewWidgets of type _review_ do not show up at all in the phone, while
  they work just fine on the desktop

Unfortunately the resolution of these issues is beyond me. As such, I chose to 
provide a simpler experience for this scope, in order to have at least a working
application and make users happy.

Once the mentioned issues get fixed and are published to the stable channel I'll be 
happy to improve the scope with more bells and whistles ;)

Happy freesounding!
