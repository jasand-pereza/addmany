(function($, window) {

  var AddMany = function() {};

  // Allow access to the AddMany Prototype outside of the jQuery
  // namespace so it can be extended
  AddMany.prototype = {

    $this_object: null,
    $results_object: null,
    $create_button: null,
    $input_original: null,
    $deleted_values_input: null,
    field_definitions: {},
    current_post_id: null,
    saved_values: [],
    deleted_values: [],
    wysiwyg_inc: 0,
    current_variation: null,

    init: function($object) {
      var self = this;
      var $ = jQuery;
      this.current_post_id = $('#post_ID').val();
      this.$this_object = $object;

      this.field_definitions = field_definitions;

      this.checkAndSetHasOtherFields();

      $object.after(this.getActualValuesTemplate());
      $object.parent().prepend(this.getDeletedValuesInputTemplate());

      this.$deleted_values_input = $object.parent()
        .find('input[name="addmany_deleted_ids"]');

      $object.parent().prepend(
        this.getFieldsVariationTemplate()
      );

      $object.parent().prepend(
        this.getCreateButtonTemplate()
      );
      $object.hide();

      this.$create_button = $object.parent()
        .find('.btn-addmany-create');

      if(this.current_post_id !== null) {
        this.loadSaved(this.appendSaved);
      }

      self.$results_object = $object.parent()
        .find('.addmany-actual-values');
      self.$results_object.css('height', 'auto');

      this.addEvents();

      this.checkAndAddWYSIWYG();

      this.addUploads(self.$this_object.find('li'));

      this.$this_object.find('.addmany-result').each(function() {
        $(this).find('.upload').each(function(){
          self.getPreviewThumb($(this));
        });
      });

      return this;
    },

    checkAndAddWYSIWYG: function() {
      // WYSIWYG editors

      var $ = jQuery;
      var self = this;
      // avoid this by loading this JavaScript file earlier
      setTimeout(function(){
        $('.addmany-actual-values').find('textarea').each(function() {
          if(!$(this).hasClass('wysiwyg')) return;
          $(this).attr('id', 'addmanywysiwyg_' + self.wysiwyg_inc);
          if(typeof(tinyMCE) == 'object' && typeof( tinyMCE.execCommand ) == 'function') {
            tinyMCE.execCommand('mceAddEditor', true, $(this).attr('id'));
          }
          self.wysiwyg_inc++;
        });
      }, 1000);

    },

    checkAndSetHasOtherFields: function() {
      if(this.$this_object.data('addmanyHasOtherFields')) {
        this.has_other_fields = true;
        return true;
      }
      return false;
    },

    setupDeleteEvents: function() {
      var $ = jQuery;
      var self = this;
      this.$results_object
        .find('.btn-addmany-delete').off('click')
        .on('click', function(e) {
          e.preventDefault();
          self.updateDeletedValues($(this).parent().data('subpostId'));
          $(this).parent().remove();
          self.updateSavedValues();
        });
    },

    updateDeletedValues: function(id) {
      this.deleted_values.push(id);
      this.$deleted_values_input.val(this.deleted_values);
    },

    appendSaved: function(data, context) {
      var self = context;
      var $ = jQuery;

      for(var result in data.posts) {
        var object_post = data.posts[result];
        var $new_template = self.getSingleResultTemplateDynamic(
          object_post
        );
        self.$results_object.append($new_template);
        var $recently_added = self.$results_object.find('li:last-child');
        self.addUploads($recently_added);

        $recently_added.find('.upload').each(function(){
          self.getPreviewThumb($(this));
        });

        self.setupDeleteEvents(
          $recently_added
        );
      }

      self.$results_object.sortable(self.getSortableConfig());


      self.$results_object
        .on('sortupdate', function(event, ui) {
          self.$results_object.sortable('refresh');
          self.updateSavedValues();
        });
    },

    getSortableConfig: function() {
      var self = this;
      var $ = jQuery;

      return {
        revert: 100,
        start: function(e, ui) {
          self.$results_object.addClass('sorting-results');
          self.$results_object.find('.wysiwyg').each(function () {
            tinyMCE.execCommand('mceRemoveEditor', true, $(this).attr('id'));
            $(this).hide();
          });
        },
        stop: function(e, ui) {
          self.$results_object.removeClass('sorting-results');
          $('.wysiwyg').each(function() {
            $(this).show();
            tinyMCE.execCommand('mceAddEditor', true, $(this).attr('id'));
          });
        }
      };
    },

    updateSavedValues: function() {
      var $ = jQuery;
      var updated_values = [];
      this.$results_object.find('li').each(function() {
        updated_values.push($(this).data('subpostId'));
      });
      this.saved_values = updated_values;
      this.$this_object.val(updated_values.join(','));
    },

    convertSavedToValues: function() {
      this.saved_values = this.$this_object.val().split(',');
    },

    loadSaved: function(callback) {
      this.convertSavedToValues();
      var $ = jQuery;
      var self = this;
      $.ajax({
        url: AJAXSubmit.ajaxurl,
        method: 'post',
        data: {
          get_by: true,
          array_ids: self.saved_values,
          field_assigned_to: self.$this_object.attr('name'),
          parent_id: self.current_post_id,
          action: 'AJAXSubmit',
          AJAXSubmit_nonce : AJAXSubmit.AJAXSubmit_nonce
        }
      }).success(function(d) {
        if(d.success) {
          if(typeof callback == 'function') {
            callback(d, self);
          }
        }
      });
    },

    createANewPost: function(parent_id, callback) {
      var $ = jQuery;
      $.ajax({
        url: AJAXSubmit.ajaxurl,
        method: 'post',
        data: {
          parent_id: parent_id,
          action: 'AJAXSubmit',
          AJAXSubmit_nonce: AJAXSubmit.AJAXSubmit_nonce,
          field_assigned_to: this.$this_object.attr('name'),
          current_variation: this.current_variation
        }
      }).success(function(d) {
        if(d.success) {
          callback(d.post_id, d.fields);
        }
      });
    },

    convertValuesToString: function(saved_values) {
      return saved_values.join(',').replace(/(^,)|(,$)/g, "");
    },

    createHandler: function(e) {

      var $ = jQuery;
      var self = this;
      e.preventDefault();
      self.createANewPost(self.current_post_id, function(new_post_id, subfields) {
        self.saved_values.push(new_post_id);
        self.$this_object.val(
          self.convertValuesToString(self.saved_values)
        );
        $new_template = self.getEmptySingleResultTemplateDynamic(new_post_id, subfields);
        self.$results_object.append($new_template);
        self.setupDeleteEvents();

        var $recently_added = self.$results_object.find('li:last-child');
        $recently_added.find('.wysiwyg').attr('id', 'addmanywysiwyg_' + self.wysiwyg_inc);
        self.$results_object.sortable(self.getSortableConfig());

        tinyMCE.execCommand('mceAddEditor', true, 'addmanywysiwyg_' + self.wysiwyg_inc);
        self.addUploads(self.$this_object.parent());
        self.wysiwyg_inc++;
      });
    },

    addEvents: function() {
      var $ = jQuery;
      var self = this;
      this.$create_button.on('click', $.proxy(this.createHandler, this));


      var field_key = this.$this_object.attr('name');
      var subfields = this.field_definitions[field_key];

      var options = $.map(subfields, function(i, key) {
        return key;
      });
      self.current_variation = options[0];

      this.$this_object.parent().find('select').on('change', function() {
        self.current_variation = options[$(this).val()];
      });
    },

    getCreateButtonTemplate: function() {
      return '<button class="btn-addmany-create button">Create new</button>';
    },

    getFieldsVariationTemplate: function() {
      var field_key = this.$this_object.attr('name');
      var subfields = this.field_definitions[field_key];
      if(Object.keys(subfields).length === 1) return;

      var options = $.map(subfields, function(i, key) {
        return key;
      });

      return Taco.Util.HTML.selecty(
        options,
        '',
        {
          name: this.$this_object.attr('name')+'_fields_variation'
        }
      );
    },

    getDeletedValuesInputTemplate: function() {
      return '<input type="hidden" name="addmany_deleted_ids">';
    },

    getDeleteButtonTemplate: function() {
      return '<button class="btn-addmany-delete button">x</button>';
    },

    getSingleResultTemplate: function(post_id, post_title, post_content) {
      post_title = (typeof post_title == 'undefined') ? '' : post_title;
      post_content = (typeof post_content == 'undefined') ? '' : post_content;

      var html  = '<li data-subpost-id="' + post_id + '" class="addmany-result postbox">';
          html += this.getDeleteButtonTemplate();
          html += '<input type="text" style="margin-bottom: 10px; width: 90%;" name="subposts['+ this.$this_object.attr('name') +'][' + post_id + '][post_title]" placeholder="title" value="' + post_title + '"><br>';
          html += '<textarea name="subposts[' + this.$this_object.attr('name') + '][' + post_id + '][post_content]" style="width: 90%;" placeholder="content">' + post_content +'</textarea>';
          html += '</li>';
      return html;
    },

    getStringFromObject: function(object, delimiter) {
      delimiter = (typeof delimiter == 'undefined')
        ? ';'
        : delimiter;
      var s = '';
      for(var o in object) {
        s += (o + ': ' + object[o] + delimiter);
      }
      return s;
    },

    getEmptySingleResultTemplateDynamic: function(post_id, subfields) {
      var html = [];
      var li_attribs = this.getResultDefaultAttribs(post_id);

      var field_key = this.$this_object.attr('name');
      html.push('<li ' + li_attribs +'>');
      html.push('<table><tbody>');
      for(var f in subfields) {

        if(typeof subfields[f] != 'object') continue;
        var html_field = 'input';
        field_value = '';
        field_type = (typeof subfields[f].type != 'undefined')
          ? subfields[f].type
          : 'text';
        field_class = (typeof subfields[f].class != 'undefined')
          ? subfields[f].class
          : '';
        field_placeholder = (typeof subfields[f].placeholder != 'undefined')
          ? subfields[f].placeholder
          : '';
        field_id = (typeof subfields[f].id != 'undefined')
          ? subfields[f].id
          : Taco.Util.General.uniqid(
              'subposts[' + this.$this_object.attr('name') + '][' + post_id + '][' + f + ']',
              'field'
            );


        // an input field
        if(Taco.Util.Arr.inArray(subfields[f].type, Taco.Util.HTML.getTextInputTypes())) {
          html_field = Taco.Util.HTML.tag(
            'input',
            null,
            {
              name: 'subposts[' + this.$this_object.attr('name') + '][' + post_id + '][' + f + ']',
              type: field_type,
              value: field_value,
              'class': field_class,
              id: field_id
            },
            true
          );
        }
        // textarea
        if(subfields[f].type == 'textarea') {
          html_field = Taco.Util.HTML.tag(
            'textarea',
            field_value,
            {
              name: 'subposts[' + this.$this_object.attr('name') + '][' + post_id + '][' + f + ']',
              type: field_type,
              'class': field_class,
              id: field_id
            },
            true
          );
        }
        // select
        if(subfields[f].type == 'select') {
          html_field = Taco.Util.HTML.selecty(
            subfields[f].options,
            subfields[f].options[field_value],
            {
              name: 'subposts[' + this.$this_object.attr('name') + '][' + post_id + '][' + f + ']',
              'class': field_class,
              id: field_id
            }
          );
        }
        // image/file
        if(subfields[f].type == 'image' || subfields[f].type == 'file') {
          upload_field = [];
          upload_field.push('<div class="upload_field">');

          upload_field.push(Taco.Util.HTML.tag(
            'input',
            field_value,
            {
              type: 'text',
              placeholder: field_placeholder,
              name: 'subposts[' + this.$this_object.attr('name') + '][' + post_id + '][' + f + ']',
              'class': field_class + ' upload',
              id: field_id
            }
          ));
          upload_field.push(Taco.Util.HTML.tag(
            'input',
            null,
            {
              type: 'button',
              value: 'Select file',
              'class': 'browse'
            }
          ));
          upload_field.push(Taco.Util.HTML.tag(
            'input',
            null,
            {
              type: 'button',
              value: 'Clear',
              'class': 'clear'
            }
          ));
          html_field = upload_field.join('');
        }

        if(subfields[f].type == 'checkbox') {
          html_field = Taco.Util.HTML.tag(
            'input',
            null,
            {
              name: 'subposts[' + this.$this_object.attr('name') + '][' + post_id + '][' + f + ']',
              type: 'checkbox',
              value: (typeof subfields[f].value != 'undefined')
                ? subfields[f].value
                : 1,
              class: field_class,
              id: field_id
            },
            true
          );
        }
        html.push('<tr>');
        html.push('<td><label>' + Taco.Util.Str.human(f) + '</label>');
        html.push('<td>');
        html.push(html_field);
        html.push('</td></tr>');
      }
      html.push(this.getDeleteButtonTemplate());
      html.push('</tbody></table></li>');
      return html.join('');
    },

    getResultDefaultAttribs: function(post_id) {
      var li_classes = 'addmany-result postbox';
      return Taco.Util.HTML.attribs({
        'class': li_classes,
        'data-subpost-id': post_id
      });
    },

    getSingleResultTemplateDynamic: function(object) {
      var html = [];
      var field_key = this.$this_object.attr('name');

      var subfields = this.field_definitions[field_key][object.fields_variation];
      var fields_data = object.fields || {};
      var post_id = object.post_id;
      li_attribs = this.getResultDefaultAttribs(post_id);

      html.push('<li ' + li_attribs +'>');
      html.push('<table><tbody>');
      for(var f in subfields) {
        if(typeof subfields[f] != 'object') continue;
        var html_field = 'input';
        field_value = (typeof fields_data[f].value != 'undefined')
          ? fields_data[f].value
          : '';
        field_type = (typeof fields_data[f].attribs.type != 'undefined')
          ? fields_data[f].attribs.type
          : 'text';
        field_class = (typeof fields_data[f].attribs.class != 'undefined')
          ? fields_data[f].attribs.class
          : '';
        field_placeholder = (typeof subfields[f].placeholder != 'undefined')
          ? subfields[f].placeholder
          : '';
        field_id = (typeof subfields[f].id != 'undefined')
          ? subfields[f].id
          : Taco.Util.General.uniqid(
              'subposts[' + this.$this_object.attr('name') + '][' + post_id + '][' + f + ']',
              'field'
            );

        // an input field
        if(Taco.Util.Arr.inArray(subfields[f].type, Taco.Util.HTML.getTextInputTypes())) {
          html_field = Taco.Util.HTML.tag(
            'input',
            null,
            {
              name: 'subposts[' + this.$this_object.attr('name') + '][' + post_id + '][' + f + ']',
              type: field_type,
              value: field_value,
              class: field_class,
              id: field_id
            },
            true
          );
        }
        // a checkbox
        if(subfields[f].type == 'checkbox') {
          var attribs = {
            name: 'subposts[' + this.$this_object.attr('name') + '][' + post_id + '][' + f + ']',
            type: 'checkbox',
            value: (typeof subfields[f].value != 'undefined')
              ? subfields[f].value
              : 1,
            'class': field_class,
            id: field_id
          };

          if(fields_data[f].value !== null) {
            attribs.checked = 'checked';
          }

          html_field = Taco.Util.HTML.tag(
            'input',
            null,
            attribs,
            true
          );
        }
        // select
        if(subfields[f].type == 'select') {
          html_field = Taco.Util.HTML.selecty(
            subfields[f].options,
            subfields[f].options[field_value],
            {
              name: 'subposts[' + this.$this_object.attr('name') + '][' + post_id + '][' + f + ']',
              'class': field_class,
              id: field_id
            }
          );
        }
        // image/file
        if(subfields[f].type == 'image' || subfields[f].type == 'file') {
          upload_field = [];
          upload_field.push('<div class="upload_field">');

          upload_field.push(Taco.Util.HTML.tag(
            'input',
            null,
            {
              type: 'text',
              value: field_value,
              placeholder: field_placeholder,
              name: 'subposts[' + this.$this_object.attr('name') + '][' + post_id + '][' + f + ']',
              'class': field_class + ' upload',
              id: field_id
            }
          ));
          upload_field.push(Taco.Util.HTML.tag(
            'input',
            null,
            {
              type: 'button',
              value: 'Select file',
              'class': 'browse'
            }
          ));
          upload_field.push(Taco.Util.HTML.tag(
            'input',
            null,
            {
              type: 'button',
              value: 'Clear',
              'class': 'clear'
            }
          ));
          html_field = upload_field.join('');
        }
        // textarea
        if(subfields[f].type == 'textarea') {
          html_field = Taco.Util.HTML.tag(
            'textarea',
            field_value,
            {
              name: 'subposts[' + this.$this_object.attr('name') + '][' + post_id + '][' + f + ']',
              type: field_type,
              'class': field_class,
              id: field_id
            },
            true
          );
        }
        html.push('<tr>');
        html.push('<td><label>' + Taco.Util.Str.human(f) + '</label>');
        html.push('<td>');
        html.push(html_field);
        html.push('</td></tr>');
      }
      html.push(this.getDeleteButtonTemplate());
      html.push('</tbody></table></li>');
      return html.join('');
    },

    getActualValuesTemplate: function() {
      return '<ul class="addmany-actual-values"></li>';
    },

    getEditLink: function() {
      return ' <a target="_blank" href="/wp-admin/post-new.php?post_type=page">Edit New Item</a>';
    },

    getPreviewThumb: function($obj) {
      if($obj.val().search(/jpg|jpeg|png|gif/gi) > -1) {
        $obj.addImage($obj.val());
      }
    },

    addUploads: function($obj) {

      // Initial loading of thumbnail
      $obj.find('.upload').each(function() {
        if($(this).val().match(/(jpg|jpeg|png|gif)$/)) {
          $(this).addImage($(this).val());
        }
      });
    }
  };

  if(!$('.addmany').length) return;

  $('.addmany').each(function() {
    (new AddMany()).init($(this));
  });
})(jQuery, window);
