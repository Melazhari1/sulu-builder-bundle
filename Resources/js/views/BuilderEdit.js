// @flow
import React, {createRef} from 'react';
import {action, observable} from 'mobx';
import {observer} from 'mobx-react';
import {Breadcrumb, Loader} from 'sulu-admin-bundle/components';
import {withToolbar} from 'sulu-admin-bundle/containers';
import {Requester} from 'sulu-admin-bundle/services';
import {translate} from 'sulu-admin-bundle/utils';
import builderConfig, {templateUrl} from '../config';
import builderStyles from './builder.scss';

/**
 * Visual template editor: embeds the builderxml app (published from
 * Resources/public/builder by assets:install) and talks to it through the
 * postMessage bridge (suluBridge.js).
 *
 * Registered under "sulu_builder.builder_edit" and used by two routes
 * (see Admin/BuilderAdmin.php):
 *   /builder/add        — add mode (no route attributes)
 *   /builder/:type/:key — edit mode
 */
@observer
class BuilderEdit extends React.Component<*> {
    @observable loading: boolean = true;
    @observable saving: boolean = false;
    @observable messageType: ?string = undefined;
    @observable messageText: ?string = undefined;

    iframeRef = createRef();
    builderReady: boolean = false;
    pendingXml: ?string = undefined;
    readyTimeout: any = undefined;

    get isAdd(): boolean {
        return !this.props.router.attributes.type;
    }

    get templateType(): string {
        return String(this.props.router.attributes.type || '');
    }

    get templateKey(): string {
        return String(this.props.router.attributes.key || '');
    }

    componentDidMount() {
        window.addEventListener('message', this.handleMessage);

        this.readyTimeout = setTimeout(action(() => {
            if (!this.builderReady) {
                this.loading = false;
                this.setMessage('error', translate('sulu_builder.builder_unreachable'));
            }
        }), 10000);

        if (!this.isAdd) {
            Requester.get(templateUrl(this.templateType, this.templateKey))
                .then(action((response) => {
                    this.pendingXml = response.content;
                    this.flushToBuilder();
                }))
                .catch(action(() => {
                    this.loading = false;
                    this.setMessage('error', translate('sulu_builder.template_load_error'));
                }));
        }
    }

    componentWillUnmount() {
        window.removeEventListener('message', this.handleMessage);
        clearTimeout(this.readyTimeout);
    }

    @action setMessage = (type: ?string, text: ?string) => {
        this.messageType = type;
        this.messageText = text;
    };

    postToBuilder(message: Object) {
        const iframe = this.iframeRef.current;
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(message, window.location.origin);
        }
    }

    @action flushToBuilder = () => {
        if (!this.builderReady) {
            return;
        }

        if (this.isAdd) {
            this.postToBuilder({type: 'sulu-builder:new'});
            this.loading = false;
        } else if (undefined !== this.pendingXml && null !== this.pendingXml) {
            this.postToBuilder({type: 'sulu-builder:load', xml: this.pendingXml});
            this.loading = false;
        }
    };

    handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
            return;
        }

        const data = event.data;
        if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
            return;
        }

        switch (data.type) {
            case 'sulu-builder:ready':
                this.builderReady = true;
                clearTimeout(this.readyTimeout);
                this.flushToBuilder();
                break;
            case 'sulu-builder:xml':
                this.handleBuilderXml(data);
                break;
            case 'sulu-builder:error':
                this.handleBuilderError(data);
                break;
        }
    };

    @action handleBuilderError = (data: Object) => {
        this.saving = false;
        this.setMessage('error', String(data.message || translate('sulu_builder.save_error')));
    };

    @action handleBuilderXml = (data: Object) => {
        const type = this.isAdd ? String(data.templateType || 'page') : this.templateType;
        const key = this.isAdd ? String(data.key || '') : this.templateKey;

        if (!key) {
            this.saving = false;
            this.setMessage('error', translate('sulu_builder.save_error'));

            return;
        }

        Requester.put(templateUrl(type, key), {content: String(data.xml)})
            .then(action(() => {
                this.saving = false;
                this.setMessage('success', translate('sulu_builder.save_success'));

                if (this.isAdd) {
                    this.props.router.navigate('sulu_builder.builder_edit', {type, key});
                }
            }))
            .catch(action(() => {
                this.saving = false;
                this.setMessage('error', translate('sulu_builder.save_error'));
            }));
    };

    @action save = () => {
        if (this.loading || this.saving) {
            return;
        }

        this.saving = true;
        this.setMessage(undefined, undefined);
        this.postToBuilder({type: 'sulu-builder:request-xml'});
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
        const title = this.isAdd
            ? translate('sulu_builder.add')
            : this.templateKey + '.xml';

        return (
            <div className={builderStyles.builder}>
                <Breadcrumb onItemClick={this.handleBack}>
                    <Breadcrumb.Item value="list">{translate('sulu_builder.title')}</Breadcrumb.Item>
                    <Breadcrumb.Item value="list">{translate('sulu_builder.templates')}</Breadcrumb.Item>
                    <Breadcrumb.Item>{this.isAdd ? translate('sulu_builder.add') : this.templateKey}</Breadcrumb.Item>
                </Breadcrumb>
                <h1 className={builderStyles.title}>
                    {title}
                    {!this.isAdd &&
                        <span className={builderStyles.titleSuffix}> — {this.templateType}</span>
                    }
                </h1>
                {this.renderMessage()}
                {this.loading &&
                    <div className={builderStyles.loaderContainer}><Loader /></div>
                }
                <iframe
                    className={builderStyles.builderFrame}
                    ref={this.iframeRef}
                    src={builderConfig.builderUrl}
                    title={translate('sulu_builder.title')}
                />
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
