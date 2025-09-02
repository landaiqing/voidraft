/**
 * voidraft - Changelog Script
 * 从GitHub API获取发布信息，支持Gitea备用源
 */

/**
 * 仓库配置类
 */
class RepositoryConfig {
  constructor() {
    this.repos = {
      github: {
        owner: 'landaiqing',
        name: 'voidraft',
        apiUrl: 'https://api.github.com/repos/landaiqing/voidraft/releases',
        releasesUrl: 'https://github.com/landaiqing/voidraft/releases'
      },
      gitea: {
        owner: 'landaiqing',
        name: 'voidraft',
        domain: 'git.landaiqing.cn',
        apiUrl: 'https://git.landaiqing.cn/api/v1/repos/landaiqing/voidraft/releases',
        releasesUrl: 'https://git.landaiqing.cn/landaiqing/voidraft/releases'
      }
    };
  }

  /**
   * 获取仓库配置
   * @param {string} source - 'github' 或 'gitea'
   */
  getRepo(source) {
    return this.repos[source];
  }

  /**
   * 获取所有仓库配置
   */
  getAllRepos() {
    return this.repos;
  }
}

/**
 * 国际化消息管理类
 */
class I18nMessages {
  constructor() {
    this.messages = {
      loading: {
        en: 'Loading releases...',
        zh: '正在加载版本信息...'
      },
      noReleases: {
        en: 'No release information found',
        zh: '没有找到版本发布信息'
      },
      fetchError: {
        en: 'Failed to load release information. Please try again later.',
        zh: '无法获取版本信息，请稍后再试'
      },
      githubApiError: {
        en: 'GitHub API returned an error status: ',
        zh: 'GitHub API返回错误状态: '
      },
      giteaApiError: {
        en: 'Gitea API returned an error status: ',
        zh: 'Gitea API返回错误状态: '
      },
      dataSource: {
        en: 'Data source: ',
        zh: '数据来源: '
      },
      downloads: {
        en: 'Downloads',
        zh: '下载资源'
      },
      download: {
        en: 'Download',
        zh: '下载'
      },
      preRelease: {
        en: 'Pre-release',
        zh: '预发布'
      }
    };
  }

  /**
   * 获取消息
   * @param {string} key - 消息键
   * @param {string} lang - 语言代码
   */
  getMessage(key, lang = 'en') {
    return this.messages[key] && this.messages[key][lang] || this.messages[key]['en'] || '';
  }

  /**
   * 获取当前语言
   */
  getCurrentLang() {
    return window.currentLang || 'en';
  }
}

/**
 * API客户端类
 */
class APIClient {
  constructor(repositoryConfig, i18nMessages) {
    this.repositoryConfig = repositoryConfig;
    this.i18nMessages = i18nMessages;
  }

  /**
   * 从指定源获取发布信息
   * @param {string} source - 'github' 或 'gitea'
   */
  async fetchReleases(source) {
    const repo = this.repositoryConfig.getRepo(source);
    const errorMessageKey = source === 'github' ? 'githubApiError' : 'giteaApiError';
    
    const options = {
      headers: { 'Accept': 'application/json' }
    };
    
    if (source === 'github') {
      return this.fetchFromGitHub(repo, options, errorMessageKey);
    } else {
      return this.fetchFromGitea(repo, options, errorMessageKey);
    }
  }

  /**
   * 从GitHub获取数据
   * @param {Object} repo - 仓库配置
   * @param {Object} options - 请求选项
   * @param {string} errorMessageKey - 错误消息键
   */
  async fetchFromGitHub(repo, options, errorMessageKey) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    options.signal = controller.signal;
    options.headers['Accept'] = 'application/vnd.github.v3+json';
    
    try {
      const response = await fetch(repo.apiUrl, options);
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`${this.i18nMessages.getMessage(errorMessageKey, this.i18nMessages.getCurrentLang())}${response.status}`);
      }
      
      const releases = await response.json();
      
      if (!releases || releases.length === 0) {
        throw new Error(this.i18nMessages.getMessage('noReleases', this.i18nMessages.getCurrentLang()));
      }
      
      return releases;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 从Gitea获取数据
   * @param {Object} repo - 仓库配置
   * @param {Object} options - 请求选项
   * @param {string} errorMessageKey - 错误消息键
   */
  async fetchFromGitea(repo, options, errorMessageKey) {
    const response = await fetch(repo.apiUrl, options);
    
    if (!response.ok) {
      throw new Error(`${this.i18nMessages.getMessage(errorMessageKey, this.i18nMessages.getCurrentLang())}${response.status}`);
    }
    
    const releases = await response.json();
    
    if (!releases || releases.length === 0) {
      throw new Error(this.i18nMessages.getMessage('noReleases', this.i18nMessages.getCurrentLang()));
    }
    
    return releases;
  }
}
  
/**
 * UI管理类
 */
class UIManager {
   constructor(i18nMessages) {
     this.i18nMessages = i18nMessages;
     this.elements = {
       loading: document.getElementById('loading'),
       changelog: document.getElementById('changelog'),
       error: document.getElementById('error-message')
     };
   }

  /**
   * 显示加载状态
   */
  showLoading() {
    this.elements.loading.style.display = 'block';
    this.elements.error.style.display = 'none';
    this.elements.changelog.innerHTML = '';
  }

  /**
   * 隐藏加载状态
   */
  hideLoading() {
    this.elements.loading.style.display = 'none';
  }

  /**
   * 显示错误消息
   * @param {string} message - 错误消息
   */
  showError(message) {
    const errorMessageElement = this.elements.error.querySelector('p');
    if (errorMessageElement) {
      errorMessageElement.textContent = message;
    } else {
      this.elements.error.textContent = message;
    }
    this.elements.error.style.display = 'block';
    this.hideLoading();
  }

  /**
   * 显示发布信息
   * @param {Array} releases - 发布信息数组
   * @param {string} source - 数据源
   */
  displayReleases(releases, source) {
    this.hideLoading();
    
    // 清除现有内容
    this.elements.changelog.innerHTML = '';
    
    // 创建数据源元素
    const sourceElement = this.createSourceElement(source);
    this.elements.changelog.appendChild(sourceElement);
    
    // 创建发布信息元素
    releases.forEach(release => {
      const releaseElement = this.createReleaseElement(release, source);
      this.elements.changelog.appendChild(releaseElement);
    });
    
    this.elements.changelog.style.display = 'block';
  }

  /**
   * 创建数据源元素
   * @param {string} source - 数据源
   */
  createSourceElement(source) {
    const sourceElement = document.createElement('div');
    sourceElement.className = 'data-source';
    
    // 创建带有国际化支持的源标签
    const sourceLabel = document.createElement('span');
    sourceLabel.setAttribute('data-en', this.i18nMessages.getMessage('dataSource', 'en'));
    sourceLabel.setAttribute('data-zh', this.i18nMessages.getMessage('dataSource', 'zh'));
    sourceLabel.textContent = this.i18nMessages.getMessage('dataSource', this.i18nMessages.getCurrentLang());
    
    // 创建链接
     const sourceLink = document.createElement('a');
     const repositoryConfig = new RepositoryConfig();
     sourceLink.href = repositoryConfig.getRepo(source).releasesUrl;
     sourceLink.textContent = source === 'github' ? 'GitHub' : 'Gitea';
     sourceLink.target = '_blank';
    
    // 组装元素
    sourceElement.appendChild(sourceLabel);
    sourceElement.appendChild(sourceLink);
    
    return sourceElement;
  }
  
  /**
   * 创建发布信息元素
   * @param {Object} release - 发布信息对象
   * @param {string} source - 数据源
   */
  createReleaseElement(release, source) {
    const releaseElement = document.createElement('div');
    releaseElement.className = 'release';
    
    // 格式化发布日期
    const releaseDate = new Date(release.published_at || release.created_at);
    const formattedDate = DateFormatter.formatDate(releaseDate);
    
    // 创建头部
    const headerElement = this.createReleaseHeader(release, formattedDate);
    releaseElement.appendChild(headerElement);
    
    // 添加发布说明
    if (release.body) {
      const descriptionElement = document.createElement('div');
      descriptionElement.className = 'release-description markdown-content';
      descriptionElement.innerHTML = MarkdownParser.parseMarkdown(release.body);
      releaseElement.appendChild(descriptionElement);
    }
    
    // 添加下载资源
    const assets = AssetManager.getAssetsFromRelease(release, source);
    if (assets && assets.length > 0) {
      const assetsElement = this.createAssetsElement(assets);
      releaseElement.appendChild(assetsElement);
    }
    
    return releaseElement;
  }
  
  /**
   * 创建发布信息头部
   */
  createReleaseHeader(release, formattedDate) {
    const headerElement = document.createElement('div');
    headerElement.className = 'release-header';
    
    // 版本元素
    const versionElement = document.createElement('div');
    versionElement.className = 'release-version';
    
    // 版本文本
    const versionText = document.createElement('span');
    versionText.textContent = release.name || release.tag_name;
    versionElement.appendChild(versionText);
    
    // 预发布标记
    if (release.prerelease) {
      const preReleaseTag = document.createElement('span');
      preReleaseTag.className = 'release-badge pre-release';
      preReleaseTag.setAttribute('data-en', this.i18nMessages.getMessage('preRelease', 'en'));
      preReleaseTag.setAttribute('data-zh', this.i18nMessages.getMessage('preRelease', 'zh'));
      preReleaseTag.textContent = this.i18nMessages.getMessage('preRelease', this.i18nMessages.getCurrentLang());
      versionElement.appendChild(preReleaseTag);
    }
    
    // 日期元素
    const dateElement = document.createElement('div');
    dateElement.className = 'release-date';
    dateElement.textContent = formattedDate;
    
    headerElement.appendChild(versionElement);
    headerElement.appendChild(dateElement);
    
    return headerElement;
  }
  
  /**
   * 创建资源文件元素
   * @param {Array} assets - 资源文件数组
   */
  createAssetsElement(assets) {
    const assetsElement = document.createElement('div');
    assetsElement.className = 'release-assets';
    
    // 资源标题
    const assetsTitle = document.createElement('div');
    assetsTitle.className = 'release-assets-title';
    assetsTitle.setAttribute('data-en', this.i18nMessages.getMessage('downloads', 'en'));
    assetsTitle.setAttribute('data-zh', this.i18nMessages.getMessage('downloads', 'zh'));
    assetsTitle.textContent = this.i18nMessages.getMessage('downloads', this.i18nMessages.getCurrentLang());
    
    // 资源列表
    const assetList = document.createElement('ul');
    assetList.className = 'asset-list';
    
    // 添加每个资源
    assets.forEach(asset => {
      const assetItem = this.createAssetItem(asset);
      assetList.appendChild(assetItem);
    });
    
    assetsElement.appendChild(assetsTitle);
    assetsElement.appendChild(assetList);
    
    return assetsElement;
  }
  
  /**
   * 创建资源文件项
   * @param {Object} asset - 资源文件对象
   */
  createAssetItem(asset) {
    const assetItem = document.createElement('li');
    assetItem.className = 'asset-item';
    
    // 文件图标
    const iconElement = document.createElement('i');
    iconElement.className = `asset-icon fas fa-${FileIconHelper.getFileIcon(asset.name)}`;
    
    // 文件名
    const nameElement = document.createElement('span');
    nameElement.className = 'asset-name';
    nameElement.textContent = asset.name;
    
    // 文件大小
    const sizeElement = document.createElement('span');
    sizeElement.className = 'asset-size';
    sizeElement.textContent = FileSizeFormatter.formatFileSize(asset.size);
    
    // 下载链接
    const downloadLink = document.createElement('a');
    downloadLink.className = 'download-btn';
    downloadLink.href = asset.browser_download_url;
    downloadLink.target = '_blank';
    downloadLink.setAttribute('data-en', this.i18nMessages.getMessage('download', 'en'));
    downloadLink.setAttribute('data-zh', this.i18nMessages.getMessage('download', 'zh'));
    downloadLink.textContent = this.i18nMessages.getMessage('download', this.i18nMessages.getCurrentLang());
    
    // 组装资源项
    assetItem.appendChild(iconElement);
    assetItem.appendChild(nameElement);
    assetItem.appendChild(sizeElement);
    assetItem.appendChild(downloadLink);
    
    return assetItem;
  }
}
  
/**
 * 资源管理器类
 */
class AssetManager {
  /**
   * 从发布信息中获取资源文件
   * @param {Object} release - 发布信息对象
   * @param {string} source - 数据源
   */
  static getAssetsFromRelease(release, source) {
    let assets = [];
    
    if (source === 'github') {
      assets = release.assets || [];
    } else { // Gitea
      assets = release.assets || [];
      // 检查Gitea特定的资源结构
      if (!assets.length && release.attachments) {
        assets = release.attachments.map(attachment => ({
          name: attachment.name,
          size: attachment.size,
          browser_download_url: attachment.browser_download_url
        }));
      }
    }
    
    return assets;
  }
}

/**
 * 文件图标助手类
 */
class FileIconHelper {
  /**
   * 根据文件扩展名获取图标
   * @param {string} filename - 文件名
   */
  static getFileIcon(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    
    const iconMap = {
      'exe': 'download',
      'msi': 'download',
      'dmg': 'download',
      'pkg': 'download',
      'deb': 'download',
      'rpm': 'download',
      'tar': 'file-archive',
      'gz': 'file-archive',
      'zip': 'file-archive',
      '7z': 'file-archive',
      'rar': 'file-archive',
      'pdf': 'file-pdf',
      'txt': 'file-alt',
      'md': 'file-alt',
      'json': 'file-code',
      'xml': 'file-code',
      'yml': 'file-code',
      'yaml': 'file-code'
    };
    
    return iconMap[extension] || 'file';
  }
}

/**
 * 文件大小格式化器类
 */
class FileSizeFormatter {
  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   */
  static formatFileSize(bytes) {
    if (!bytes) return '';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

/**
 * 日期格式化器类
 */
class DateFormatter {
  /**
   * 格式化日期
   * @param {Date} date - 日期对象
   */
  static formatDate(date) {
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    
    const lang = window.currentLang || 'en';
    const locale = lang === 'zh' ? 'zh-CN' : 'en-US';
    
    return date.toLocaleDateString(locale, options);
  }
}

/**
 * Markdown解析器类
 */
class MarkdownParser {
  /**
   * 简单的Markdown解析
   * @param {string} markdown - Markdown文本
   */
  static parseMarkdown(markdown) {
    if (!markdown) return '';
    
    // 预处理：保留原始换行符，用特殊标记替换
    const preservedLineBreaks = '___LINE_BREAK___';
    markdown = markdown.replace(/\n/g, preservedLineBreaks);
    
    // 引用块 - > text
    markdown = markdown.replace(/&gt;\s*(.*?)(?=&gt;|$)/g, '<blockquote>$1</blockquote>');
    markdown = markdown.replace(/>\s*(.*?)(?=>|$)/g, '<blockquote>$1</blockquote>');
    
    // 链接 - [text](url)
    markdown = markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // 标题 - # Heading
    markdown = markdown.replace(/^### (.*?)(?=___LINE_BREAK___|$)/gm, '<h3>$1</h3>');
    markdown = markdown.replace(/^## (.*?)(?=___LINE_BREAK___|$)/gm, '<h2>$1</h2>');
    markdown = markdown.replace(/^# (.*?)(?=___LINE_BREAK___|$)/gm, '<h1>$1</h1>');
    
    // 粗体 - **text**
    markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 斜体 - *text*
    markdown = markdown.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // 代码块 - ```code```
    markdown = markdown.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // 行内代码 - `code`
    markdown = markdown.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 处理列表项
    // 先将每个列表项转换为HTML
    markdown = markdown.replace(/- (.*?)(?=___LINE_BREAK___- |___LINE_BREAK___$|$)/g, '<li>$1</li>');
    markdown = markdown.replace(/\* (.*?)(?=___LINE_BREAK___\* |___LINE_BREAK___$|$)/g, '<li>$1</li>');
    markdown = markdown.replace(/\d+\. (.*?)(?=___LINE_BREAK___\d+\. |___LINE_BREAK___$|$)/g, '<li>$1</li>');
    
    // 然后将连续的列表项包装在ul或ol中
    const listItemRegex = /<li>.*?<\/li>/g;
    const listItems = markdown.match(listItemRegex) || [];
    
    if (listItems.length > 0) {
      // 将连续的列表项组合在一起
      let lastIndex = 0;
      let result = '';
      let inList = false;
      
      listItems.forEach(item => {
        const itemIndex = markdown.indexOf(item, lastIndex);
        
        // 添加列表项之前的内容
        if (itemIndex > lastIndex) {
          result += markdown.substring(lastIndex, itemIndex);
        }
        
        // 如果不在列表中，开始一个新列表
        if (!inList) {
          result += '<ul>';
          inList = true;
        }
        
        // 添加列表项
        result += item;
        
        // 更新lastIndex
        lastIndex = itemIndex + item.length;
        
        // 检查下一个内容是否是列表项
        const nextItemIndex = markdown.indexOf('<li>', lastIndex);
        if (nextItemIndex === -1 || nextItemIndex > lastIndex + 20) { // 如果下一个列表项不紧邻
          result += '</ul>';
          inList = false;
        }
      });
      
      // 添加剩余内容
      if (lastIndex < markdown.length) {
        result += markdown.substring(lastIndex);
      }
      
      markdown = result;
    }
    
    // 处理水平分隔线
    markdown = markdown.replace(/---/g, '<hr>');
    
    // 恢复换行符
    markdown = markdown.replace(/___LINE_BREAK___/g, '<br>');
    
    // 处理段落
    markdown = markdown.replace(/<br><br>/g, '</p><p>');
    
    // 包装在段落标签中
    if (!markdown.startsWith('<p>')) {
      markdown = `<p>${markdown}</p>`;
    }
    
    return markdown;
  }
}

/**
 * 更新日志主应用类
 */
class ChangelogApp {
  constructor() {
    this.repositoryConfig = new RepositoryConfig();
    this.i18nMessages = new I18nMessages();
    this.apiClient = new APIClient(this.repositoryConfig, this.i18nMessages);
    this.uiManager = new UIManager(this.i18nMessages);
    
    this.init();
  }

  /**
   * 初始化应用
   */
  init() {
    this.uiManager.showLoading();
    
    // 首先尝试GitHub API
    this.apiClient.fetchReleases('github')
      .then(releases => {
        this.uiManager.displayReleases(releases, 'github');
      })
      .catch(() => {
        // GitHub失败时尝试Gitea
        return this.apiClient.fetchReleases('gitea')
          .then(releases => {
            this.uiManager.displayReleases(releases, 'gitea');
          });
      })
      .catch(error => {
        console.error('获取发布信息失败:', error);
        this.uiManager.showError(this.i18nMessages.getMessage('fetchError', this.i18nMessages.getCurrentLang()));
      });
    
    // 监听语言变化事件
    document.addEventListener('languageChanged', () => this.updateUI());
  }

  /**
   * 更新UI元素（当语言变化时）
   */
  updateUI() {
    const elementsToUpdate = document.querySelectorAll('[data-en][data-zh]');
    const currentLang = this.i18nMessages.getCurrentLang();
    
    elementsToUpdate.forEach(element => {
      const text = element.getAttribute(`data-${currentLang}`);
      if (text) {
        element.textContent = text;
      }
    });
  }
}

// 当DOM加载完成时初始化应用
document.addEventListener('DOMContentLoaded', () => {
  new ChangelogApp();
});