from django import forms


def style_form_fields(form):
    for field in form.fields.values():
        widget = field.widget
        if isinstance(widget, forms.Textarea):
            css = "textarea"
        elif isinstance(widget, forms.Select):
            css = "select"
        else:
            css = "input"
        widget.attrs.setdefault("class", css)
