import { Tabs } from "@base-ui/react/tabs";
import styles from "./components/AppTabs.module.css";
import OverviewPanel from "./components/OverviewPanel";
import { ProjectsPanel } from "./components/ProjectsPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import "./App.css";

export default function App() {
  return (
    <main className={styles.Page}>
      <Tabs.Root className={styles.Tabs} defaultValue="overview">
        {/* tabsliste */}
        <Tabs.List className={styles.List}>
          <Tabs.Tab className={styles.Tab} value="overview">
            Overview
          </Tabs.Tab>
          <Tabs.Tab className={styles.Tab} value="projects">
            Projects
          </Tabs.Tab>
          <Tabs.Tab className={styles.Tab} value="settings">
            Settings
          </Tabs.Tab>
          <Tabs.Indicator className={styles.Indicator} />
        </Tabs.List>
        {/* einzelne inhalte der tabsliste */}
        <Tabs.Panel className={styles.Panel} value="overview">
          <OverviewPanel />
        </Tabs.Panel>
        <Tabs.Panel className={styles.Panel} value="projects">
          <ProjectsPanel />
        </Tabs.Panel>
        <Tabs.Panel className={styles.Panel} value="settings">
          <SettingsPanel />
        </Tabs.Panel>
      </Tabs.Root>
    </main>
  );
}
