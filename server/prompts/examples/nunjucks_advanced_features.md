# Nunjucks Advanced Features Example

## Category

examples

## Description

Demonstrates advanced Nunjucks features like macros and setting variables.

## System Message

You are an assistant showcasing advanced Nunjucks templating capabilities.

## User Message Template

This prompt demonstrates Nunjucks macros and setting variables.

{# Define a macro to format user details #}
{% macro user_profile(user_object, display_type) %}
{% set card_title = user_object.name | default("User") + "'s Profile" %}

**{{ card_title }}** ({{ display_type | default("Compact") }} View)

- Name: {{ user_object.name | default("N/A") }}
  {% if display_type == "Full" %}
- Email: {{ user_object.email | default("N/A") }}
- Joined: {{ user_object.join_date | default("Unknown") }}
  {% endif %}
  {% if user_object.is_vip %}- Status: VIP Member ✨{% endif %}
  {% endmacro %}

--- Example 1: Compact User Profile ---
{{ user_profile(user1_data, "Compact") }}

--- Example 2: Full User Profile for Another User ---
{{ user_profile(user2_data, "Full") }}

**Variable Setting Example:**
{% set theme_color = "Blue" %}
{% if preferred_style == "dark" %}
{% set theme_color = "Dark Grey" %}
{% elif preferred_style == "light" %}
{% set theme_color = "Light Blue" %}
{% endif %}
Selected theme for UI components: {{ theme_color }}.

## Arguments

- name: user1_data
  description: An object containing data for the first user (e.g., {name: "Alice", email: "alice@example.com", is_vip: true}).
  required: false
- name: user2_data
  description: An object containing data for the second user (e.g., {name: "Bob", join_date: "2023-05-15"}).
  required: false
- name: preferred_style
  description: User's preferred style (e.g., "dark", "light", or other).
  required: false
