import {Injectable} from '@angular/core';
import {Position} from './position';
import {ErrorType, RestStatus} from '@app/log-view/log-file';
import {EventsLogChanged, StatusHolderEvent} from '@app/log-view/backend-events';
import {ActivatedRoute, Router} from '@angular/router';

@Injectable()
export class ViewStateService {
    private _selectedLine: Position;

    hashes: { [key: string]: string };
    statuses: { [key: string]: RestStatus } = {};

    filesNotFoundCount: number;
    filesErrorCount: number;
    filesValidCount: number;

    size: number;

    constructor(private route: ActivatedRoute, private router: Router) {

    }

    get selectedLine(): Position {
        return this._selectedLine
    }

    setSelectedWithoutFragmentChange(selectedLine: Position) {
        this._selectedLine = selectedLine;
    }

    createFragment() {
        if (!this._selectedLine)
            return null;

        let fragment: string = 'p' + this._selectedLine.o;

        if (Object.keys(this.statuses).length > 1) {
            fragment = this._selectedLine.logId + '-' + fragment;
        }

        return fragment;
    }

    set selectedLine(selectedLine: Position) {
        this._selectedLine = selectedLine;

        let newLocation = ('' + window.location).replace(/#[^#]+$/, '')
        window.location.replace(newLocation + '#' + (this.createFragment() ?? ''))
    }

    logChanged(event: EventsLogChanged): boolean {
        let hasNewChanges = false;

        for (const [logId, fileAttr] of Object.entries(event.changedLogs)) {
            let status = this.statuses[logId];
            if (status && status.errorType == null) {
                if (fileAttr == null) {
                    hasNewChanges = true;
                } else if (status.lastModification < fileAttr.modifiedTime // note: modifiedTime doesn't contain milliseconds
                    || status.lastModification === fileAttr.modifiedTime && status.size !== fileAttr.size) {
                    hasNewChanges = true;
                    status.lastModification = fileAttr.modifiedTime;
                    status.size = fileAttr.size;
                }
            }
        }

        return hasNewChanges;
    }

    public handleStatuses(event: StatusHolderEvent): boolean {
        let size = 0;
        let hashes: { [key: string]: string } = {};
        let st: { [key: string]: RestStatus } = {};
        let filesValidCount = 0;

        for (let logId of Object.keys(event.statuses)) {
            let oldStatus = this.statuses[logId];
            if (oldStatus && !oldStatus.hash) {
                continue; // Don't override broken log status
            }

            let status = event.statuses[logId];

            if (status.hash) {
                hashes[logId] = status.hash;
                size += status.size;
                filesValidCount++;
            } else {
                if (status.errorType === ErrorType.LOG_CRASHED_EXCEPTION) {
                    return false;
                }
            }

            st[logId] = status;
        }

        this.statuses = {...this.statuses, ...st};

        let filesNotFoundCount = 0;
        let filesErrorCount = 0;

        for (let logId of Object.keys(this.statuses)) {
            if (!this.statuses[logId].hash) {
                if (this.statuses[logId].errorType === ErrorType.FILE_NOT_FOUND) {
                    filesNotFoundCount++;
                } else {
                    filesErrorCount++;
                }
            }
        }

        this.size = size;
        this.hashes = hashes;
        this.filesNotFoundCount = filesNotFoundCount;
        this.filesErrorCount = filesErrorCount;
        this.filesValidCount = filesValidCount;

        return true;
    }
}
