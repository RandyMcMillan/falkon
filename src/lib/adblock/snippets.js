/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

function regexEscape(string)
{
  return string.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function toRegExp(pattern)
{
  if (pattern.length >= 2 && pattern[0] == "/" &&
      pattern[pattern.length - 1] == "/")
    return new RegExp(pattern.substring(1, pattern.length - 1));
  return new RegExp(regexEscape(pattern));
}

/**
 * Generates a random alphanumeric ID consisting of 6 base-36 digits
 * from the range 100000..zzzzzz (both inclusive).
 *
 * @returns {string} The random ID.
 */
function randomId()
{
  // 2176782336 is 36^6 which mean 6 chars [a-z0-9]
  // 60466176 is 36^5
  // 2176782336 - 60466176 = 2116316160. This ensure to always have 6
  // chars even if Math.random() returns its minimum value 0.0
  //
  return Math.floor(Math.random() * 2116316160 + 60466176).toString(36);
}

function wrapPropertyAccess(object, property, descriptor)
{
  let dotIndex = property.indexOf(".");
  if (dotIndex === -1)
  {
    // simple property case.
    let currentDescriptor = Object.getOwnPropertyDescriptor(object, property);
    if (currentDescriptor && !currentDescriptor.configurable)
      return;

    // Keep it configurable because the same property can be wrapped via
    // multiple snippet filters (#7373).
    let newDescriptor = Object.assign({}, descriptor, {configurable: true});

    if (!currentDescriptor && !newDescriptor.get && newDescriptor.set)
    {
      let propertyValue = object[property];
      newDescriptor.get = () => propertyValue;
    }

    Object.defineProperty(object, property, newDescriptor);
    return;
  }

  let name = property.slice(0, dotIndex);
  property = property.slice(dotIndex + 1);
  let value = object[name];
  if (value && (typeof value == "object" || typeof value == "function"))
    wrapPropertyAccess(value, property, descriptor);

  let currentDescriptor = Object.getOwnPropertyDescriptor(object, name);
  if (currentDescriptor && !currentDescriptor.configurable)
    return;

  let setter = newValue =>
  {
    value = newValue;
    if (newValue && (typeof newValue == "object" || typeof value == "function"))
      wrapPropertyAccess(newValue, property, descriptor);
  };

  Object.defineProperty(object, name, {
    get: () => value,
    set: setter,
    configurable: true
  });
}

function overrideOnError(magic)
{
  let {onerror} = window;
  window.onerror = (message, ...rest) =>
  {
    if (typeof message == "string" && message.includes(magic))
      return true;
    if (typeof onerror == "function")
      return (() => {}).call.call(onerror, this, message, ...rest);
  };
}

/**
 * Patches a property on the window object to abort execution when the
 * property is read.
 *
 * No error is printed to the console.
 *
 * The idea originates from
 * [uBlock Origin](https://github.com/uBlockOrigin/uAssets/blob/80b195436f8f8d78ba713237bfc268ecfc9d9d2b/filters/resources.txt#L1703).
 * @alias module:content/snippets.abort-on-property-read
 *
 * @param {string} property The name of the property.
 *
 * @since Adblock Plus 3.4.1
 */
function abort_on_property_read(property)
{
  abortOnRead("abort-on-property-read", window, property);
}

function abortOnRead(loggingPrefix, context, property)
{
//  let debugLog = (debug ? log : () => {}).bind(null, loggingPrefix);

  if (!property)
  {
//    debugLog("no property to abort on read");
    return;
  }

  let rid = randomId();

  function abort()
  {
//    debugLog(`${property} access aborted`);
    throw new ReferenceError(rid);
  }

//  debugLog(`aborting on ${property} access`);

  wrapPropertyAccess(context, property, {get: abort, set() {}});
  overrideOnError(rid);
}

/**
 * Patches a property on the window object to abort execution when the
 * property is written.
 *
 * No error is printed to the console.
 *
 * The idea originates from
 * [uBlock Origin](https://github.com/uBlockOrigin/uAssets/blob/80b195436f8f8d78ba713237bfc268ecfc9d9d2b/filters/resources.txt#L1671).
 * @alias module:content/snippets.abort-on-property-write
 *
 * @param {string} property The name of the property.
 *
 * @since Adblock Plus 3.4.3
 */
function abort_on_property_write(property)
{
  abortOnWrite("abort-on-property-write", window, property);
}

function abortOnWrite(loggingPrefix, context, property)
{
//  let debugLog = (debug ? log : () => {}).bind(null, loggingPrefix);

  if (!property)
  {
//    debugLog("no property to abort on write");
    return;
  }

  let rid = randomId();

  function abort()
  {
//    debugLog(`setting ${property} aborted`);
    throw new ReferenceError(rid);
  }

//  debugLog(`aborting when setting ${property}`);

  wrapPropertyAccess(context, property, {set: abort});
  overrideOnError(rid);
}

/**
 * Aborts the execution of an inline script.
 * @alias module:content/snippets.abort-current-inline-script
 *
 * @param {string} api API function or property name to anchor on.
 * @param {?string} [search] If specified, only scripts containing the given
 *   string are prevented from executing. If the string begins and ends with a
 *   slash (`/`), the text in between is treated as a regular expression.
 *
 * @since Adblock Plus 3.4.3
 */
function abort_current_inline_script(api, search = null)
{
  let re = search ? toRegExp(search) : null;

  let rid = randomId();
  let us = document.currentScript;

  let object = window;
  let path = api.split(".");
  let name = path.pop();

  for (let node of path)
  {
    object = object[node];

    if (!object || !(typeof object == "object" || typeof object == "function"))
      return;
  }

  let {get: prevGetter, set: prevSetter} =
    Object.getOwnPropertyDescriptor(object, name) || {};

  let currentValue = object[name];

  let abort = () =>
  {
    let element = document.currentScript;
    if (element instanceof HTMLScriptElement && element.src == "" &&
        element != us && (!re || re.test(element.textContent)))
      throw new ReferenceError(rid);
  };

  let descriptor = {
    get()
    {
      abort();

      if (prevGetter)
        return prevGetter.call(this);

      return currentValue;
    },
    set(value)
    {
      abort();

      if (prevSetter)
        prevSetter.call(this, value);
      else
        currentValue = value;
    }
  };

  wrapPropertyAccess(object, name, descriptor);

  overrideOnError(rid);
}

/**
 * Traps calls to JSON.parse, and if the result of the parsing is an Object, it
 * will remove specified properties from the result before returning to the
 * caller.
 *
 * The idea originates from
 * [uBlock Origin](https://github.com/gorhill/uBlock/commit/2fd86a66).
 * @alias module:content/snippets.json-prune
 *
 * @param {string} rawPrunePaths A list of space-separated properties to remove.
 * @param {?string} [rawNeedlePaths] A list of space-separated properties which
 *   must be all present for the pruning to occur.
 *
 * @since Adblock Plus 3.9.0
 */
function json_prune(rawPrunePaths, rawNeedlePaths = "")
{
  if (!rawPrunePaths)
    throw new Error("Missing paths to prune");
  let prunePaths = rawPrunePaths.split(/ +/);
  let needlePaths = rawNeedlePaths !== "" ? rawNeedlePaths.split(/ +/) : [];
  let currentValue = JSON.parse;
  let descriptor = {
    value(...args)
    {
      let result;
      result = currentValue.apply(this, args);
      if (needlePaths.length > 0 &&
          needlePaths.some(path => !findOwner(result, path)))
        return result;
      for (let path of prunePaths)
      {
        let details = findOwner(result, path);
        if (typeof details != "undefined")
          delete details[0][details[1]];
      }
      return result;
    }
  };
  Object.defineProperty(JSON, "parse", descriptor);
  function findOwner(root, path)
  {
    if (!(root instanceof window.Object))
      return;
    let object = root;
    let chain = path.split(".");
    if (chain.length === 0)
      return;
    for (let i = 0; i < chain.length - 1; i++)
    {
      let prop = chain[i];
      if (!object.hasOwnProperty(prop))
        return;
      object = object[prop];
      if (!(object instanceof window.Object))
        return;
    }
    let prop = chain[chain.length - 1];
    if (object.hasOwnProperty(prop))
      return [object, prop];
  }
}

/**
 * Overrides a property's value on the window object with a set of
 * available properties.
 *
 * Possible values to override the property with:
 *   undefined
 *   false
 *   true
 *   null
 *   noopFunc   - function with empty body
 *   trueFunc   - function returning true
 *   falseFunc  - function returning false
 *   ''         - empty string
 *   positive decimal integer, no sign, with maximum value of 0x7FFF
 *
 * The idea originates from
 * [uBlock Origin](https://github.com/uBlockOrigin/uAssets/blob/80b195436f8f8d78ba713237bfc268ecfc9d9d2b/filters/resources.txt#L2105).
 * @alias module:content/snippets.override-property-read
 *
 * @param {string} property The name of the property.
 * @param {string} value The value to override the property with.
 *
 * @since Adblock Plus 3.9.4
 */
function override_property_read(property, value)
{
  if (!property)
  {
    throw new Error("[override-property-read snippet]: " +
                    "No property to override.");
  }
  if (typeof value === "undefined")
  {
    throw new Error("[override-property-read snippet]: " +
                    "No value to override with.");
  }

  let cValue;
//  let debugLog = (debug ? log : () => {})
//    .bind(null, "override-property-read");

  if (value === "false")
  {
    cValue = false;
  }
  else if (value === "true")
  {
    cValue = true;
  }
  else if (value === "null")
  {
    cValue = null;
  }
  else if (value === "noopFunc")
  {
    cValue = () => {};
  }
  else if (value === "trueFunc")
  {
    cValue = () => true;
  }
  else if (value === "falseFunc")
  {
    cValue = () => false;
  }
  else if (/^\d+$/.test(value))
  {
    cValue = parseFloat(value);
  }
  else if (value === "")
  {
    cValue = value;
  }
  else if (value !== "undefined")
  {
    throw new Error("[override-property-read snippet]: " +
                    `Value "${value}" is not valid.`);
  }

  let newGetter = () =>
  {
//    debugLog(`${property} override done.`);
    return cValue;
  };

//  debugLog(`Overriding ${property}.`);

  wrapPropertyAccess(window, property, {get: newGetter, set() {}});
}

/**
 * Strips a query string parameter from `fetch()` calls.
 * @alias module:content/snippets.strip-fetch-query-parameter
 *
 * @param {string} name The name of the parameter.
 * @param {?string} [urlPattern] An optional pattern that the URL must match.
 *
 * @since Adblock Plus 3.5.1
 */
function strip_fetch_query_parameter(name, urlPattern = null)
{
  let fetch_ = window.fetch;
  if (typeof fetch_ != "function")
    return;

  let urlRegExp = urlPattern ? toRegExp(urlPattern) : null;
  window.fetch = function fetch(...args)
  {
    let [source] = args;
    if (typeof source == "string" &&
        (!urlRegExp || urlRegExp.test(source)))
    {
      let url = new URL(source);
      url.searchParams.delete(name);
      args[0] = url.href;
    }

    return fetch_.apply(this, args);
  };
}
