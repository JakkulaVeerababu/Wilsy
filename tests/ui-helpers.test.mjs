import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceText,copyPageLink,isEditing} from '../ui-helpers.js';
import {escapeHtml} from '../directory-core.js';
test('Source descriptions retain paragraphs and lists without executing markup',()=>{
  const text=sourceText('<h2>About &amp; you</h2><p>Build things.<br>Learn.</p><ul><li>JavaScript</li><li>SQL</li></ul><script>alert(1)</script>');
  assert.equal(text,'About & you\n\nBuild things.\nLearn.\n\n• JavaScript\n• SQL');
  const unsafe=sourceText('&lt;img src=x onerror=alert(1)&gt;');
  assert.doesNotMatch(escapeHtml(unsafe),/<img/);
});
test('Copy links handle denied clipboard access and a closed dialog',async()=>{
  const button={isConnected:true,textContent:'Copy link'};
  await copyPageLink(button,'https://www.wilsy.in/jobs?job=1',undefined);
  assert.equal(button.textContent,'Copy the address bar link');
  await copyPageLink(button,'https://www.wilsy.in/jobs?job=1',{writeText:()=>{throw Error('blocked');}});
  assert.equal(button.textContent,'Copy the address bar link');
  let copied='';await copyPageLink(button,'https://www.wilsy.in/jobs?job=1',{writeText:async value=>{copied=value;}});
  assert.equal(copied,'https://www.wilsy.in/jobs?job=1');assert.equal(button.textContent,'Link copied ✓');
  button.isConnected=false;button.textContent='Detached';await copyPageLink(button,'url',{writeText:async()=>{}});
  assert.equal(button.textContent,'Detached');
});
test('Automatic refresh pauses for active text and filter inputs',()=>{
  assert.equal(isEditing({tagName:'INPUT'}),true);assert.equal(isEditing({tagName:'SELECT'}),true);
  assert.equal(isEditing({tagName:'DIV',isContentEditable:true}),true);assert.equal(isEditing({tagName:'BUTTON'}),false);
});
