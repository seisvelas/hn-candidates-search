import './App.css';
import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';

const findHiringThreadsUrl = `https://hn.algolia.com/api/v1/search_by_date?query=Ask%20HN:%20&tags=ask_hn,author_whoishiring&hitsPerPage=1000`;

function Candidate(author, comment, date, postId) {
  // TODO: Parse comment here to add additional optional fields
  return {
    author, comment, date, postId,
    remote: !!comment.toLowerCase().replace(/\s+/g, '').match(/remote:y|remote:ok/g), // regex to find remote in comment
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
        <div dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(`
          <div class="posting" key=${i}>
            <b>Author:</b> <a href="https://news.ycombinator.com/user?id=${e.author}">${e.author}</a><br />
            <b>Date:</b> <a href="https://news.ycombinator.com/item?id=${e.postId}">${e.date}</a>
            <p />${e.comment}<p />
          </div>
          <hr />`)
        }}/>
      )
    );
  return (
    <div id="candidates-container">
      <div id="show-button-line">{commentCode.length} jobseekers match your search requirements&nbsp;&nbsp;&nbsp;
      <span onClick={()=>setHidden(!hidden)}>{hidden ? "show ▼" : "hide ▲"}</span></div>
      {hidden ? "" : commentCode}
    </div>
  );
}

function App() {
  const [comments, setComments] = useState([]);
  const [condition, setCondition] = useState(null);

  useEffect(() => {
    const acquireComments = async () => {
      setComments([]);
      const response = await fetch(findHiringThreadsUrl);
      const data = await response.json();
      data.hits
        .filter(h => h.title.includes("wants") && h.created_at.includes(new Date().getFullYear())) // todo: check last n months (configurable via ui) instead of current year
        .map(h => h.objectID)
        .forEach(async t => {
          const specificMonthRawResponse = await fetch(`https://hn.algolia.com/api/v1/search_by_date?query=&tags=comment,story_${t}&hitsPerPage=1000`);
          const { hits: specificMonthJsonResponses } = await specificMonthRawResponse.json();
            const newComments = [];
            specificMonthJsonResponses
              .filter(c => `${c.parent_id}` === `${t}`)
              .forEach( ({author, comment_text, created_at, objectID}) => {
                newComments.push(
                  Candidate(author, comment_text, created_at, objectID)
                );
            })
            setComments(c => [...newComments, ...c]);
        });
      }
      acquireComments();
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
