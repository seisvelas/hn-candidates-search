import './App.css';
import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';

const algoliaUrl = `https://hn.algolia.com/api/v1/search_by_date?query=Ask%20HN:%20${new Date().getFullYear()}&tags=ask_hn,author_whoishiring&hitsPerPage=1000`;
let changed = false;

function Candidate(author, comment, date) {
  // TODO: Parse comment here to add additional optional fields
  return {
    author, comment, date,
    remote: !!comment.toLowerCase().replace(/\s+/g, '').match(/remote:y/g), // regex to find remote in comment
    location: undefined,
    will_relocate: undefined // ^^^^
  };
}

function SearchBar({setCondition}) {
  const [remote, setRemote] = useState(false);
  const [search, setSearch] = useState([]);
  const [location, setLocation] = useState([]);

  useEffect(() => {
    setCondition({remote, search, location})
  }, [remote, search, location, setCondition]);
  
  return (
    <div id="search-bar">
      Skills: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<input type="text" onChange={e=>setSearch(e.target.value.replace(/\s+/g, '').split(","))}/> <em>(comma seperated, eg: React, Django, Security)</em><br/>
      Location: <input type="text" onChange={e=>setLocation(e.target.value)} /><br />
      Remote: &nbsp;<input type="checkbox" onClick={()=>setRemote(!remote)} />
    </div>
  )
}

function parseLocation(comment) {
  for (const line of comment.toLowerCase().split(/<p|\n/)) {
    if (line.includes("location")) {
      return line;
    }
  }
  return "";
}

function Jobs({comments, condition}) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
  }, [comments]);
  console.log(condition)
  const commentCode = comments
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .filter(c => {
      if (condition.remote && c.remote !== condition.remote) {
        return false;
      }
      for (const term of condition.search) {
        if (!c.comment.toLowerCase().includes(term.toLowerCase())) {
          return false;
        }
      }
      if (condition.location && !parseLocation(c.comment).includes(condition.location)) {
        return false;
      }
      return true;
    }).map(
      (e, i) => (
        /*
          We dangerously set inner HTML. In theory, as long as HN's XSS filtering is good to go,
          we should be fine, since we only receive HTML served from HN and they already filter for this.
          But just in case, we use DOMPurify to remove XSS from the comments.
        */
        <div dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(`<div class="posting" key=${i}><b>Author:</b> ${e.author}<br /><b>Date:</b> ${e.date}<p />${e.comment}<p /></div><hr />`)}}/>
      )
    );
  return (
    <div id="candidates-container">
      <div id="show-button-line">{commentCode.length} jobseekers match your search requirements&nbsp;&nbsp;&nbsp;
      <span onClick={()=>setHidden(!hidden)}>{hidden ? "show ▼" : "hide ▲"}</span></div>
      {hidden ? "" : commentCode}
    </div>
  )
}

function App() {
  const [comments, setComments] = useState([]);
  const [condition, setCondition] = useState(null);

  useEffect(() => {
    setComments([])
    if (!changed) {
      fetch(algoliaUrl)
      .then(response => response.json())
      .then(data => {
        data.hits
          .filter(h => h.title.includes("wants") && h.created_at.includes(new Date().getFullYear()))
          .map(h => h.objectID)
          .forEach(t => {
            fetch(`https://hn.algolia.com/api/v1/search_by_date?query=&tags=comment,story_${t}&hitsPerPage=1000`)
            .then(response => response.json())
            .then(data => {
              const newComments = [];
              data.hits
                .filter(c => `${c.parent_id}` === `${t}`)
                .forEach( ({author, comment_text, created_at}) => {
                newComments.push(
                  Candidate(author, comment_text, created_at)
                );
              })
              setComments(c => [...newComments, ...c]);
            });
          });
      });
    }
    changed = true;
  }, []);

  return (
    <div className="App">
      <center><h1>HN Candidates Search</h1>
      <div id="author">by <a href="https://github.com/seisvelas/hn-candidates-search" id="xandre" rel="noopener noreferrer nofollow" target="_blank">Xandre</a></div></center>
      <SearchBar setCondition={setCondition} />
      <Jobs comments={comments} condition={condition} />
    </div>
  );
}

export default App;
