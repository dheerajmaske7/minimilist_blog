---
layout: default
title: "Welcome to my Blogs"
---
<div class="visitor-stats">
    <span>👥 Today's Reads/Total Reads: </span>
    <a href="https://hits.seeyoufarm.com">
        <img src="https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fdheerajmaske7.github.io&count_bg=%2379C83D&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=&edge_flat=false"/>
    </a>
</div>

### Blog Posts

Welcome to my blog! Problems based writing for the cryptosystems world :

<ul>
{% for post in site.posts %}
    <li>
        <a href="{{ post.url | relative_url }}">{{ post.title }}</a> - {{ post.date | date: "%Y-%m-%d" }}
    </li>
{% endfor %}
</ul>

<nav class="pagination">
    {% if paginator.previous_page %}
    <a href="{{ paginator.previous_page_path | relative_url }}">Newer Posts</a>
    {% endif %}
    {% if paginator.next_page %}
    <a href="{{ paginator.next_page_path | relative_url }}">Older Posts</a>
    {% endif %}
</nav>


