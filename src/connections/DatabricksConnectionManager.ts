import * as vscode from 'vscode';
import { Helper } from '../helpers/Helper';
import { ExportFormatsConfiguration, iWorkspaceConfiguration, iUserWorkspaceConfiguration, ThisExtension } from '../ThisExtension';
import { DatabricksConnection } from './DatabricksConnection';
import { DatabricksApiService } from '../databricksApi/databricksApiService';

export class DatabricksConnectionManager {

	private _workspaceConfig: iWorkspaceConfiguration;
	private _connections: DatabricksConnection[];
	private _activeConnection: DatabricksConnection;

	private _initialized: boolean;

	constructor() {
		this._initialized = false;
		this._workspaceConfig = vscode.workspace.getConfiguration().get('databricks.workspaceConfiguration');

		if (this._workspaceConfig.workspaceGuid == undefined) {
			this._workspaceConfig.workspaceGuid = Helper.newGuid();
		}

		this.loadConnections();

		this.updateUserWorkspaceConfig();

		if (this._workspaceConfig.lastActiveConnection == undefined) {
			this._workspaceConfig.lastActiveConnection = this._connections[0].displayName;
		}
		this.activateConnection(this._workspaceConfig.lastActiveConnection);
	}

	loadConnections(): void {
		/*
		there are 3 different areas from where Connections can be loaded from:
		1) the VSCode Workspace configuration using a list of connections in setting 'databricks.connections'
		2) the VSCode Workspace configuration using the default connection populated via the GUI. Settings 'databricks.connection.default.*'
		3) the VSCode User/Machine configuration in setting 'databricks.userWorkspaceConfigurations' for the current workspaceGuid

		1) and 2) are used to add new or update existing connections hence they have priority over 3)
		*/

		this._connections = this.getConnectionsFromWorkspace();

		let defaultConnectionFromWorkspace = this.getDefaultConnectionFromWorkspace();
		let connectionsFromUserConfig = this.getConnectionsFromUserConfig();

		if (!this._connections.map((x) => x.displayName).includes(defaultConnectionFromWorkspace.displayName) && defaultConnectionFromWorkspace.isValid) {
			this._connections.push(defaultConnectionFromWorkspace);
		}

		let newConnectionsFromWorkspace: DatabricksConnection[] = connectionsFromUserConfig.filter((x) => !(this._connections.map((y) => y.displayName).includes(x.displayName)));

		this._connections = this._connections.concat(newConnectionsFromWorkspace);

		this._initialized = true;
	}

	activateConnection(displayName: string): DatabricksConnection {

		let filteredConnections: DatabricksConnection[] = this.Connections.filter((x) => x.displayName == displayName);

		if (filteredConnections.length == 1) {
			this._activeConnection = filteredConnections[0];
			this._workspaceConfig.lastActiveConnection = displayName;

			DatabricksApiService.initialize(this.ActiveConnection);

			this.updateWorkspaceConfig();

			return this._activeConnection;
		}
		else {
			throw new Error("Connection with name  '" + displayName + "' could not be found!");
		}
	}

	private getConnectionsFromUserConfig(): DatabricksConnection[] {
		let currentUserWorkspaceConfig: iUserWorkspaceConfiguration = this.CurrentUserWorkspaceConfiguration;

		if (currentUserWorkspaceConfig != undefined) {
			return currentUserWorkspaceConfig.connections as DatabricksConnection[];
		}
		else {
			return [];
		}
	}

	private getConnectionsFromWorkspace(): DatabricksConnection[] {
		let envs: DatabricksConnection[] = vscode.workspace.getConfiguration().get('databricks.connections');

		return envs;
	}

	private getDefaultConnectionFromWorkspace(): DatabricksConnection {
		let defaultCon: DatabricksConnection = new DatabricksConnection();
		defaultCon.displayName = vscode.workspace.getConfiguration().get('databricks.connection.default.displayName');
		defaultCon.cloudProvider = vscode.workspace.getConfiguration().get('databricks.connection.default.cloudProvider');
		defaultCon.apiRootUrl = vscode.workspace.getConfiguration().get('databricks.connection.default.apiRootUrl');
		defaultCon.personalAccessToken = vscode.workspace.getConfiguration().get('databricks.connection.default.personalAccessToken');
		defaultCon.localSyncFolder = vscode.workspace.getConfiguration().get('databricks.connection.default.localSyncFolder');

		defaultCon.databricksConnectJars = vscode.workspace.getConfiguration().get('databricks.connection.default.databricksConnectJars');
		defaultCon.pythonInterpreter = vscode.workspace.getConfiguration().get('databricks.connection.default.pythonInterpreter');
		defaultCon.port = vscode.workspace.getConfiguration().get<number>('databricks.connection.default.port');
		defaultCon.organizationId = vscode.workspace.getConfiguration().get('databricks.connection.default.organizationId');
		defaultCon.exportFormatsConfiguration = vscode.workspace.getConfiguration().get<ExportFormatsConfiguration>('databricks.connection.default.exportFormats');

		return defaultCon;
	}

	private cleanConnectionsFromConfig(): void {
		vscode.workspace.getConfiguration().update('databricks.connections', undefined, vscode.ConfigurationTarget.Workspace);
	}

	private cleanDefaultConnectionFromConfig(): void {
		vscode.workspace.getConfiguration().update('databricks.connection.default.displayName', undefined, vscode.ConfigurationTarget.Workspace);
		vscode.workspace.getConfiguration().update('databricks.connection.default.cloudProvider', undefined, vscode.ConfigurationTarget.Workspace);
		vscode.workspace.getConfiguration().update('databricks.connection.default.apiRootUrl', undefined, vscode.ConfigurationTarget.Workspace);
		vscode.workspace.getConfiguration().update('databricks.connection.default.personalAccessToken', undefined, vscode.ConfigurationTarget.Workspace);
		vscode.workspace.getConfiguration().update('databricks.connection.default.localSyncFolder', undefined, vscode.ConfigurationTarget.Workspace);

		vscode.workspace.getConfiguration().update('databricks.connection.default.databricksConnectJars', undefined, vscode.ConfigurationTarget.Workspace);
		vscode.workspace.getConfiguration().update('databricks.connection.default.pythonInterpreter', undefined, vscode.ConfigurationTarget.Workspace);
		vscode.workspace.getConfiguration().update('databricks.connection.default.port', undefined, vscode.ConfigurationTarget.Workspace);
		vscode.workspace.getConfiguration().update('databricks.connection.default.organizationId', undefined, vscode.ConfigurationTarget.Workspace);
		vscode.workspace.getConfiguration().update('databricks.connection.default.exportFormats', undefined, vscode.ConfigurationTarget.Workspace);
	}

	private updateWorkspaceConfig(): void {
		vscode.workspace.getConfiguration().update('databricks.workspaceConfiguration', this._workspaceConfig, vscode.ConfigurationTarget.Workspace);
	}

	private get CurrentWorkspaceConfiguration(): iUserWorkspaceConfiguration {
		return {
			"workspaceConfig": this._workspaceConfig,
			"connections": this.Connections
		};
	}

	private get AllUserWorkspaceConfigurations(): iUserWorkspaceConfiguration[] {
		let allUserWorkspaceConfigs: iUserWorkspaceConfiguration[] = vscode.workspace.getConfiguration().get('databricks.userWorkspaceConfigurations');

		return allUserWorkspaceConfigs;
	}

	private get CurrentUserWorkspaceConfiguration(): iUserWorkspaceConfiguration {
		let allUserWorkspaceConfigs: iUserWorkspaceConfiguration[] = this.AllUserWorkspaceConfigurations;

		let currentUserWorkspaceConfig: iUserWorkspaceConfiguration[] = allUserWorkspaceConfigs.filter((x) => x.workspaceConfig.workspaceGuid == this._workspaceConfig.workspaceGuid);

		if (currentUserWorkspaceConfig.length == 1) {
			return currentUserWorkspaceConfig[0];
		}
		else if (currentUserWorkspaceConfig.length == 0) {
			return undefined;
		}

		throw new Error("There is an error in your User Workspace Configurations ('databricks.userWorkspaceConfigurations'). Please make sure all 'workspaceGuid' are unique!");
	}

	private updateUserWorkspaceConfig(): void {
		ThisExtension.log("Updating user setting 'databricks.userWorkspaceConfigurations' ...");
		let AllUserWorkspaceConfigurations: iUserWorkspaceConfiguration[] = this.AllUserWorkspaceConfigurations;
		let currentUserWorkspaceConfig: iUserWorkspaceConfiguration = this.CurrentUserWorkspaceConfiguration;

		let updatedUserWorkspaceConfigs: iUserWorkspaceConfiguration[] = [];

		if (currentUserWorkspaceConfig != undefined) {
			// get the original userWorkspaceConfigs except for the current one basically leaving all others unchanged
			updatedUserWorkspaceConfigs = AllUserWorkspaceConfigurations.filter((x) => x.workspaceConfig.workspaceGuid != this._workspaceConfig.workspaceGuid);
			// append the current/changed WorkspaceConfig
			updatedUserWorkspaceConfigs.push(this.CurrentWorkspaceConfiguration);
		}
		else {
			updatedUserWorkspaceConfigs = AllUserWorkspaceConfigurations;
			updatedUserWorkspaceConfigs.push(currentUserWorkspaceConfig);
		}

		let update = vscode.workspace.getConfiguration().update('databricks.userWorkspaceConfigurations', updatedUserWorkspaceConfigs, vscode.ConfigurationTarget.Global);
		update.then((x) =>
			ThisExtension.log("User setting 'databricks.userWorkspaceConfigurations' was updated!")
		);

		ThisExtension.log("Removing workspace settings 'databricks.*' as they have been persisted in the user settings!");
		this.cleanConnectionsFromConfig();
		this.cleanDefaultConnectionFromConfig();
	}

	get ActiveConnection(): DatabricksConnection {
		return this._activeConnection;
	}

	get ActiveConnectionName(): string {
		return this.ActiveConnection.displayName;
	}

	get Connections(): DatabricksConnection[] {
		while (!this._initialized) { Helper.wait(500); }

		return this._connections;
	}

	static get WorkspaceSubFolder(): string {
		return "Workspace";
	}

	static get ClustersSubFolder(): string {
		return "Clusters";
	}

	static get JobsSubFolder(): string {
		return "Jobs";
	}
}