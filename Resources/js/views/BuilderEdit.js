// @flow
import React from 'react';
import {action, observable} from 'mobx';
import {observer} from 'mobx-react';
import {Breadcrumb, Loader} from 'sulu-admin-bundle/components';
import {withToolbar} from 'sulu-admin-bundle/containers';
import {Requester} from 'sulu-admin-bundle/services';
import {translate} from 'sulu-admin-bundle/utils';
import {templateUrl} from '../config';
import builderStyles from './builder.scss';

/**
 * XML editor for a single template. Registered under "sulu_builder.builder_edit"
 * and attached to the "/builder/:type/:key" admin route by Admin/BuilderAdmin.php.
 */
@observer
class BuilderEdit extends React.Component<*> {
    @observable content: string = '';
    @observable loading: boolean = true;
    @observable saving: boolean = false;
    @observable messageType: ?string = undefined;
    @observable messageText: ?string = undefined;

    get templateType(): string {
        return String(this.props.router.attributes.type);
    }

    get templateKey(): string {
        return String(this.props.router.attributes.key);
    }

    componentDidMount() {
        this.load();
    }

    @action setMessage = (type: ?string, text: ?string) => {
        this.messageType = type;
        this.messageText = text;
    };

    @action load = () => {
        this.loading = true;
        this.setMessage(undefined, undefined);

        Requester.get(templateUrl(this.templateType, this.templateKey))
            .then(action((response) => {
                this.content = response.content;
                this.loading = false;
            }))
            .catch(action(() => {
                this.loading = false;
                this.setMessage('error', translate('sulu_builder.template_load_error'));
            }));
    };

    @action save = () => {
        if (this.loading || this.saving) {
            return;
        }

        this.saving = true;
        this.setMessage(undefined, undefined);

        Requester.put(templateUrl(this.templateType, this.templateKey), {content: this.content})
            .then(action(() => {
                this.saving = false;
                this.setMessage('success', translate('sulu_builder.save_success'));
            }))
            .catch(action(() => {
                this.saving = false;
                this.setMessage('error', translate('sulu_builder.save_error'));
            }));
    };

    @action handleContentChange = (event: SyntheticEvent<HTMLTextAreaElement>) => {
        this.content = event.currentTarget.value;
        if (this.messageType) {
            this.setMessage(undefined, undefined);
        }
    };

    handleBack = () => {
        this.props.router.navigate('sulu_builder.builder');
    };

    renderMessage() {
        if (!this.messageText) {
            return null;
        }

        const messageClass = 'error' === this.messageType
            ? builderStyles.messageError
            : builderStyles.messageSuccess;

        return <p className={messageClass}>{this.messageText}</p>;
    }

    render() {
        return (
            <div className={builderStyles.builder}>
                <Breadcrumb onItemClick={this.handleBack}>
                    <Breadcrumb.Item value="list">{translate('sulu_builder.title')}</Breadcrumb.Item>
                    <Breadcrumb.Item value="list">{translate('sulu_builder.templates')}</Breadcrumb.Item>
                    <Breadcrumb.Item>{this.templateKey}</Breadcrumb.Item>
                </Breadcrumb>
                <h1 className={builderStyles.title}>
                    {this.templateKey}.xml
                    <span className={builderStyles.titleSuffix}> — {this.templateType}</span>
                </h1>
                {this.renderMessage()}
                {this.loading
                    ? <div className={builderStyles.loaderContainer}><Loader /></div>
                    : <textarea
                        className={builderStyles.editor}
                        disabled={this.saving}
                        onChange={this.handleContentChange}
                        spellCheck={false}
                        value={this.content}
                    />
                }
            </div>
        );
    }
}

export default withToolbar(BuilderEdit, function() {
    return {
        backButton: {
            onClick: this.handleBack,
        },
        items: [
            {
                type: 'button',
                label: translate('sulu_admin.save'),
                icon: 'su-save',
                disabled: this.loading,
                loading: this.saving,
                onClick: this.save,
            },
        ],
    };
});
