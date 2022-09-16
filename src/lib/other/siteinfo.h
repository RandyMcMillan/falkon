/* ============================================================
* Falkon - Qt web browser
* Copyright (C) 2010-2018 David Rosca <nowrep@gmail.com>
*
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
*
* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
* ============================================================ */
#ifndef SITEINFO_H
#define SITEINFO_H

#include "qzcommon.h"
#include "sitesettingsmanager.h"

#include <QUrl>
#include <QDialog>

namespace Ui
{
class SiteInfo;
}

class QNetworkReply;
class QTreeWidgetItem;
class QTreeWidget;

class WebView;
class CertificateInfoWidget;

class FALKON_EXPORT SiteInfo : public QDialog
{
    Q_OBJECT

public:
    explicit SiteInfo(WebView *view);
    ~SiteInfo();

    static bool canShowSiteInfo(const QUrl &url);

private Q_SLOTS:
    void showImagePreview(QTreeWidgetItem *item);
    void imagesCustomContextMenuRequested(const QPoint &p);
    void tagsCustomContextMenuRequested(const QPoint &p);
    void copySelectedItems(const QTreeWidget* treeWidget, const bool both);
    void saveImage();
    void saveSiteSettings();

private:
    void showLoadingText();
    void showPixmap(QPixmap pixmap);

    void addPermissionOption(const SiteSettingsManager::PageOptions option);
    void addPermissionOption(const QWebEnginePage::Feature feature);
    void addPermissionOption(const QWebEngineSettings::WebAttribute attribute);

    Ui::SiteInfo* ui;
    CertificateInfoWidget* m_certWidget;
    WebView* m_view;
    QNetworkReply *m_imageReply;

    QUrl m_baseUrl;
};

#endif // SITEINFO_H
