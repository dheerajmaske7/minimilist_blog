---
layout: default
title: "Welcome to my Blogs"
---

### Blog Posts

Welcome to my blog! Here are my latest posts:

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
