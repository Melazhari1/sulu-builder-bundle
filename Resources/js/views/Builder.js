// @flow
import React from 'react';
import {action, observable} from 'mobx';
import {observer} from 'mobx-react';
import {Breadcrumb, Loader, Table} from 'sulu-admin-bundle/components';
import {withToolbar} from 'sulu-admin-bundle/containers';
import {Requester} from 'sulu-admin-bundle/services';
import {translate} from 'sulu-admin-bundle/utils';
import builderStyles from './builder.scss';

const TEMPLATES_ENDPOINT = '/admin/api/builder/templates';

/**
 * The "Sulu Builder" Administration view.
 *
 * Registered in ../index.js under the key "sulu_builder.builder" and attached
 * to the "/builder" admin route by Admin/BuilderAdmin.php.
 */
@observer
class Builder extends React.Component<{}> {
    @observable templates: Array<Object> = [];
    @observable loading: boolean = true;
    @observable error: boolean = false;

    componentDidMount() {
        this.load();
    }

    @action load = () => {
        this.loading = true;
        this.error = false;

        Requester.get(TEMPLATES_ENDPOINT)
            .then(action((response) => {
                this.templates = response._embedded.templates;
                this.loading = false;
            }))
            .catch(action(() => {
                this.templates = [];
                this.error = true;
                this.loading = false;
            }));
    };

    renderTemplates() {
        if (this.error) {
            return <p className={builderStyles.message}>{translate('sulu_builder.loading_error')}</p>;
        }

        if (this.templates.length === 0) {
            return <p className={builderStyles.message}>{translate('sulu_builder.no_templates')}</p>;
        }

        return (
            <Table>
                <Table.Header>
                    <Table.HeaderCell>{translate('sulu_builder.template_key')}</Table.HeaderCell>
                    <Table.HeaderCell>{translate('sulu_builder.template_type')}</Table.HeaderCell>
                    <Table.HeaderCell>{translate('sulu_builder.template_path')}</Table.HeaderCell>
                    <Table.HeaderCell>{translate('sulu_builder.template_modified')}</Table.HeaderCell>
                </Table.Header>
                <Table.Body>
                    {this.templates.map((template) => (
                        <Table.Row key={template.id}>
                            <Table.Cell>{template.key}</Table.Cell>
                            <Table.Cell>{template.type}</Table.Cell>
                            <Table.Cell>{template.path}</Table.Cell>
                            <Table.Cell>{new Date(template.modified).toLocaleString()}</Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table>
        );
    }

    render() {
        return (
            <div className={builderStyles.builder}>
                <Breadcrumb onItemClick={this.load}>
                    <Breadcrumb.Item>{translate('sulu_builder.title')}</Breadcrumb.Item>
                    <Breadcrumb.Item>{translate('sulu_builder.templates')}</Breadcrumb.Item>
                </Breadcrumb>
                <h1 className={builderStyles.title}>{translate('sulu_builder.title')}</h1>
                {this.loading
                    ? <div className={builderStyles.loaderContainer}><Loader /></div>
                    : this.renderTemplates()
                }
            </div>
        );
    }
}

export default withToolbar(Builder, function() {
    return {
        items: [
            {
                type: 'button',
                label: translate('sulu_builder.reload'),
                icon: 'su-sync',
                loading: this.loading,
                onClick: this.load,
            },
        ],
    };
});
